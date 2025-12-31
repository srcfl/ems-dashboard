import bs58 from 'bs58';

const SOURCEFUL_API = 'https://api.srcful.dev/';

export interface Site {
  id: string;
  name?: string;
  ownerWallet: string;
  devices?: Device[];
}

export interface Device {
  rawSn: string;
  ders: DER[];
}

export interface DER {
  derSn: string;
  gwId: string;
}

export interface Gateway {
  id: string;
  name: string;
  wallet: string;
  timeZone?: string;
}

function createAuthMessage(publicKey: string, expirationMinutes = 10): string {
  const now = new Date();
  const expiration = new Date(now.getTime() + expirationMinutes * 60 * 1000);

  const formatDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

  return `Sourceful wants you to sign data with your Solana account:
${publicKey}

EMS Dashboard Authentication

Issued At (UTC): ${formatDate(now)}
Expiration Time (UTC): ${formatDate(expiration)}`;
}

export async function getSitesForWallet(
  publicKey: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<Site[]> {
  const message = createAuthMessage(publicKey);
  const messageBytes = new TextEncoder().encode(message);

  // Sign the message
  const signatureBytes = await signMessage(messageBytes);

  // Encode both as base58
  const encodedMessage = bs58.encode(messageBytes);
  const encodedSignature = bs58.encode(signatureBytes);

  // Query GraphQL API
  const query = `
    query Sites {
      sites {
        list {
          id
          devices {
            rawSn
            ders {
              derSn
              gwId
            }
          }
        }
      }
    }
  `;

  const response = await fetch(SOURCEFUL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-message': encodedMessage,
      'x-auth-signature': encodedSignature,
    },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL error');
  }

  return data.data?.sites?.list || [];
}

export async function getGatewaysForWallet(
  publicKey: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<Gateway[]> {
  const message = createAuthMessage(publicKey);
  const messageBytes = new TextEncoder().encode(message);

  const signatureBytes = await signMessage(messageBytes);

  const encodedMessage = bs58.encode(messageBytes);
  const encodedSignature = bs58.encode(signatureBytes);

  const query = `
    query Gateways {
      gateway {
        list(wallet: "${publicKey}") {
          name
          id
          wallet
          timeZone
        }
      }
    }
  `;

  const response = await fetch(SOURCEFUL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-message': encodedMessage,
      'x-auth-signature': encodedSignature,
    },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL error');
  }

  return data.data?.gateway?.list || [];
}

// Alternative: Get sites by wallet from our backend (uses InfluxDB wallet_id mapping)
export async function getSitesByWalletFromBackend(walletAddress: string): Promise<string[]> {
  const response = await fetch(`/api/wallet/${walletAddress}/sites`);
  if (!response.ok) {
    throw new Error('Failed to fetch sites');
  }
  const data = await response.json();
  return data.sites || [];
}
