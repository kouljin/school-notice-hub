import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { School } from '@/types';

// Use Next.js caching explicitly
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const schools: School[] = body.schools;

        if (!schools || !Array.isArray(schools)) {
            return NextResponse.json({ error: 'Invalid schools data' }, { status: 400 });
        }

        const result: Record<string, Record<string, boolean>> = {};
        const now = new Date();

        // 7 days in ms
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        // Create an array of promises to fetch all boards
        const fetchPromises = [];

        for (const school of schools) {
            result[school.id] = {};
            const boards = school.boards || [];

            for (const board of boards) {
                const url = `https://school.gyo6.net/${school.sysId}/na/ntt/selectNttList.do?mi=${board.mi}&bbsId=${board.bbsId}`;

                // Native fetch with Next.js revalidate (caches for 1 hour)
                const p = fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    next: { revalidate: 3600 }
                })
                    .then(res => res.text())
                    .then(html => {
                        const $ = cheerio.load(html);
                        let hasNew = false;

                        $('.bbs_ListA tbody tr').each((_, element) => {
                            // Find the 4th td element (index 3) which is usually the date
                            let dateText = $(element).find('td').eq(3).text().trim();
                            // Sometimes boards are slightly different, so if length feels completely wrong, fallback to looking for dots or dashes
                            if (!dateText || dateText.length > 20) {
                                // some pins have no date, try another col
                                dateText = $(element).find('td').filter((_, el) => !!$(el).text().match(/\d{4}[\.\-]\d{2}[\.\-]\d{2}/)).first().text().trim();
                            }

                            if (!dateText) return;

                            // Normalize date (ko: 2023. 10. 12. -> 2023-10-12)
                            const cleanDate = dateText.replace(/\./g, '-').replace(/\s/g, '').replace(/-$/, '');

                            const noticeDate = new Date(cleanDate);
                            if (!isNaN(noticeDate.getTime())) {
                                const diff = now.getTime() - noticeDate.getTime();
                                if (diff >= -86400000 && diff <= SEVEN_DAYS) {
                                    hasNew = true;
                                }
                            }
                        });

                        result[school.id][board.id] = hasNew;
                    })
                    .catch(err => {
                        console.error(`Failed to fetch status for ${school.id} - ${board.id}`, err);
                        result[school.id][board.id] = false;
                    });

                fetchPromises.push(p);
            }
        }

        await Promise.all(fetchPromises);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error checking notices status:', error);
        return NextResponse.json({ error: 'Failed to check notices status' }, { status: 500 });
    }
}
