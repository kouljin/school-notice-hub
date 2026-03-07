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

        // 3 days in ms
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

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
                            // td[3] contains "등록일 2026.02.27" — extract date with regex
                            const tdText = $(element).find('td').eq(3).text().trim();
                            const dateMatch = tdText.match(/(\d{4}[.\-]\d{2}[.\-]\d{2})/);
                            let dateText = dateMatch ? dateMatch[1] : '';

                            // Fallback: search all td cells for a date pattern
                            if (!dateText) {
                                $(element).find('td').each((_, el) => {
                                    const m = $(el).text().match(/(\d{4}[.\-]\d{2}[.\-]\d{2})/);
                                    if (m) { dateText = m[1]; return false; }
                                });
                            }

                            if (!dateText) return;

                            // Normalize date (ko: 2023.12.31 -> 2023-12-31)
                            const cleanDate = dateText.replace(/\./g, '-').replace(/\s/g, '').replace(/-$/, '');

                            const noticeDate = new Date(cleanDate);
                            if (!isNaN(noticeDate.getTime())) {
                                const diff = now.getTime() - noticeDate.getTime();
                                if (diff >= -86400000 && diff <= THREE_DAYS) {
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
