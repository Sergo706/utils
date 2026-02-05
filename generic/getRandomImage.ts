/**
 * Represents the structure of an image result from the Picsum API.
 */
export interface ImageResults {
  id: string;
  author: string;
  width: number;
  height: number;
  url: string;
  download_url: string;
}

/**
 * Creates a random image fetcher instance.
 * 
 * @param limit - The number of images to fetch.
 * @returns An object containing the `getter` function and a helper `toUrls`.
 * 
 * @example
 * const { getter, toUrls } = getRandomImage(5);
 * const images = await getter();
 * const urls = toUrls(images);
 */
export function getRandomImage(limit: number): {
    /** Fetches the random images. Falls back to deterministic seed generation on error. */
    getter: () => Promise<ImageResults[] | Error>;
    /** Helper to extract download URLs from the results and convert them into array. */
    toUrls: (result: ImageResults[] | Error) => string[];
} {
    const getter = async (): Promise<ImageResults[] | Error> => {
        try {
            const items: ImageResults[] = [];
            let currentPage = 1;
            const perPageLimit = 100;

            while (items.length < limit) {
                const remaining = limit - items.length;
                const fetchLimit = Math.min(perPageLimit, remaining);

                const res = await fetch(`https://picsum.photos/v2/list?page=${String(currentPage)}&limit=${String(fetchLimit)}`, {
                    headers: {
                        "Cache-Control": "no-cache"
                    }
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${String(res.status)} while fetching picsum list`);
                }

                const dataJson = await res.json() as unknown;
                const data = dataJson as ImageResults[];
                
                if (data.length === 0) {
                    break;
                }

                items.push(...data);
                currentPage++;
            }

            return items;
        } catch (err) {
            const items: ImageResults[] = [];
            for (let i = 0; i < limit; i++) {
                const width = 400 + ((i * 37) % 600);
                const height = 400 + ((i * 53) % 600);
                const rand = i + 1;
                const seed = `seed-${String(rand)}`;
                const url = `https://picsum.photos/seed/${seed}/${String(width)}/${String(height)}`;
                items.push({
                    id: String(i + 1),
                    author: 'seed',
                    width,
                    height,
                    url,
                    download_url: url,
                });
            }
            return items;
        }
    };

    const toUrls = (result: ImageResults[] | Error): string[] => {
        if (Array.isArray(result)) {
            return result.map((it) => it.download_url);
        }
        return [];
    };

    return { getter, toUrls };
}
