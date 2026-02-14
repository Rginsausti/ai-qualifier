import axios from 'axios';

export interface HeadlessConfig {
    url: string;
    waitSelector: string;
    scrollCount?: number;
}

const REQUEST_TIMEOUT_MS = Number(process.env.HEADLESSX_TIMEOUT_MS ?? "120000");
const MAX_RETRIES = Number(process.env.HEADLESSX_MAX_RETRIES ?? "2");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetriableStatus = (status?: number) =>
    typeof status === 'number' && (status === 429 || status >= 500);

export async function scrapeWithHeadlessX(config: HeadlessConfig): Promise<string> {
    const headlessXEndpoint = process.env.HEADLESSX_API_URL || 'http://localhost:3000/api/render';
    const authToken = process.env.HEADLESSX_AUTH_TOKEN;

    if (!authToken) {
        throw new Error('HEADLESSX_AUTH_TOKEN is required');
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await axios.post(headlessXEndpoint, {
                url: config.url,
                stealthMode: true,
                behaviorSimulation: true,
                wait: {
                    selector: config.waitSelector,
                    timeout: 30000,
                },
                scroll: {
                    count: config.scrollCount || 3,
                    delay: 1000,
                },
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                timeout: REQUEST_TIMEOUT_MS,
            });

            if (response.status === 200 && response.data?.html) {
                return response.data.html;
            }

            throw new Error(`Invalid HeadlessX response status: ${response.status}`);
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            const retriable = isRetriableStatus(status);
            const canRetry = retriable && attempt < MAX_RETRIES;

            console.error('[HeadlessX] Request failed', {
                attempt: attempt + 1,
                status: status ?? null,
                message: error instanceof Error ? error.message : 'unknown',
                retriable,
            });

            if (!canRetry) {
                throw error;
            }

            await delay(300 * (attempt + 1));
        }
    }

    throw new Error('HeadlessX request failed after retries');
}
