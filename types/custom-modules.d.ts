declare module 'geohash' {
  export const GeoHash: {
    encodeGeoHash: (latitude: number, longitude: number, precision?: number) => string;
    decodeGeoHash: (
      hash: string
    ) => {
      latitude: number[];
      longitude: number[];
    };
    calculateAdjacent: (hash: string, direction: string) => string;
  };
}

declare module 'web-push' {
  export type PushSubscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
      [key: string]: string | undefined;
    };
  };

  export interface SendResult {
    statusCode: number;
  }

  export function setVapidDetails(contact: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string,
    options?: Record<string, unknown>
  ): Promise<SendResult>;

  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };

  export default webpush;
}
