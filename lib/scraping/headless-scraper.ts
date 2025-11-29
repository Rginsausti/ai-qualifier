import axios from 'axios';

export interface HeadlessConfig {
    url: string;
    waitSelector: string;
    scrollCount?: number;
}

export async function scrapeWithHeadlessX(config: HeadlessConfig): Promise<string> {
    const headlessXEndpoint = process.env.HEADLESSX_API_URL || 'http://localhost:3000/api/render';
    const authToken = process.env.HEADLESSX_AUTH_TOKEN;

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
                delay: 1000
            }
        }, {
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            timeout: 120000 // Increased to 120s for Render cold starts
        });

        if (response.status === 200 && response.data?.html) {
            return response.data.html;
        }
        throw new Error(`Invalid response: ${response.status}`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`[HeadlessX] HTTP Error: ${error.response?.status} ${error.response?.statusText}`);
            console.error(`[HeadlessX] Response Data:`, JSON.stringify(error.response?.data, null, 2));
        } else {
            console.error(`[HeadlessX] Error: ${(error as Error).message}`);
        }
        throw error;
    }
}
