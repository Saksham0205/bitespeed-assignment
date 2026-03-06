import { prisma } from "./db";
import type { IdentifyResponse } from "./types";

/**
 * Identity Reconciliation Service
 * Links customer contacts across multiple purchases by email/phone
 */
export async function identifyContact(
  email: string | null | undefined,
  phoneNumber: string | number | null | undefined
): Promise<IdentifyResponse> {
  // Normalize inputs - convert phoneNumber to string for consistency
  const emailStr = email && String(email).trim() ? String(email).trim() : null;
  const phoneStr =
    phoneNumber !== null && phoneNumber !== undefined && String(phoneNumber).trim()
      ? String(phoneNumber).trim()
      : null;

  // Must have at least one contact identifier
  if (!emailStr && !phoneStr) {
    throw new Error("Either email or phoneNumber is required");
  }

  // Find all contacts matching email or phone (excluding soft-deleted)
  const matchingContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(emailStr ? [{ email: emailStr }] : []),
        ...(phoneStr ? [{ phoneNumber: phoneStr }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (matchingContacts.length === 0) {
    // No existing contact - create new primary
    const newContact = await prisma.contact.create({
      data: {
        email: emailStr,
        phoneNumber: phoneStr,
        linkPrecedence: "primary",
      },
    });

    return {
      contact: {
        primaryContatctId: newContact.id,
        emails: newContact.email ? [newContact.email] : [],
        phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
        secondaryContactIds: [],
      },
    };
  }

  // Find the primary contact - either the one with linkPrecedence "primary" or the oldest
  let primaryContact = matchingContacts.find((c) => c.linkPrecedence === "primary");
  const secondaryContacts = matchingContacts.filter((c) => c.linkPrecedence === "secondary");

  // If no primary in matches, find it via linkedId chain
  if (!primaryContact) {
    const linkedIds = new Set(secondaryContacts.map((c) => c.linkedId).filter(Boolean));
    primaryContact = matchingContacts.find((c) => linkedIds.has(c.id)) ?? matchingContacts[0];
    // Fetch the actual primary if we got a secondary
    if (primaryContact?.linkPrecedence === "secondary" && primaryContact.linkedId) {
      const actualPrimary = await prisma.contact.findUnique({
        where: { id: primaryContact.linkedId },
      });
      if (actualPrimary) primaryContact = actualPrimary;
    }
  }

  // Check if we have multiple primary contacts that need to be linked
  const allPrimaries = matchingContacts.filter((c) => c.linkPrecedence === "primary");
  if (allPrimaries.length >= 2) {
    // Sort by createdAt - oldest becomes primary, newer becomes secondary
    const [oldestPrimary, ...newerPrimaries] = allPrimaries.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    primaryContact = oldestPrimary;

    // Convert newer primaries to secondary
    for (const newerPrimary of newerPrimaries) {
      await prisma.contact.update({
        where: { id: newerPrimary.id },
        data: {
          linkedId: oldestPrimary.id,
          linkPrecedence: "secondary",
        },
      });
    }
  }

  // Ensure we have the primary (oldest in the chain)
  if (primaryContact?.linkedId) {
    const chainPrimary = await prisma.contact.findUnique({
      where: { id: primaryContact.linkedId },
    });
    if (chainPrimary) primaryContact = chainPrimary;
  }

  const primaryId = primaryContact!.id;

  // Get all contacts linked to this primary (including secondaries we may have just created)
  const allLinkedContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [{ id: primaryId }, { linkedId: primaryId }],
    },
    orderBy: { createdAt: "asc" },
  });

  // Check if we need to create a new secondary (incoming has new email or phone not in any linked contact)
  const existingEmails = new Set(
    allLinkedContacts.map((c) => c.email).filter((e): e is string => !!e)
  );
  const existingPhones = new Set(
    allLinkedContacts.map((c) => c.phoneNumber).filter((p): p is string => !!p)
  );

  const hasNewEmail = emailStr && !existingEmails.has(emailStr);
  const hasNewPhone = phoneStr && !existingPhones.has(phoneStr);

  if (hasNewEmail || hasNewPhone) {
    const newSecondary = await prisma.contact.create({
      data: {
        email: emailStr ?? undefined,
        phoneNumber: phoneStr ?? undefined,
        linkedId: primaryId,
        linkPrecedence: "secondary",
      },
    });
    allLinkedContacts.push(newSecondary);
  }

  // Build response - primary first, then secondaries
  const primary = allLinkedContacts.find((c) => c.id === primaryId)!;
  const secondaries = allLinkedContacts.filter((c) => c.id !== primaryId);

  const emails: string[] = [];
  const phoneNumbers: string[] = [];

  if (primary.email) emails.push(primary.email);
  for (const c of secondaries) {
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
  }

  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);
  for (const c of secondaries) {
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber)) phoneNumbers.push(c.phoneNumber);
  }

  return {
    contact: {
      primaryContatctId: primaryId,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaries.map((c) => c.id),
    },
  };
}
