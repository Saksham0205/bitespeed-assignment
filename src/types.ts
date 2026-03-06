export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | number | null;
}

export interface IdentifyResponse {
  contact: {
    primaryContatctId: number; // Note: typo from spec - "primaryContatctId"
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}
