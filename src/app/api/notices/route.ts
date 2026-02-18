import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { SCHOOLS } from '@/const/schools';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const page = searchParams.get('page') || '1';
    const search = searchParams.get('search') || '';

    // Custom params overrides
    const sysId = searchParams.get('sysId');
    const mi = searchParams.get('mi');
    const bbsId = searchParams.get('bbsId');

    let school = SCHOOLS.find((s) => s.id === schoolId);

    // If school not found in config, but params are provided, create a temp school config
    if (!school && sysId && mi && bbsId && schoolId) {
        school = {
            id: schoolId,
            name: 'Custom School', // Name doesn't matter for the fetch
            sysId,
            mi,
            bbsId
        };
    }

    if (!school) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    try {
        const url = `https://school.gyo6.net/${school.sysId}/na/ntt/selectNttList.do`;
        const params: any = {
            mi: school.mi,
            bbsId: school.bbsId,
            currPage: page,
        };

        if (search) {
            params.searchType = 'sj'; // Search by title (sj) or content (cn) or both (sjcn). 'sj' is safest default.
            params.searchValue = search;
        }

        const response = await axios.get(url, {
            params,
            responseType: 'text', // Ensure we get text
        });

        const $ = cheerio.load(response.data);
        const notices: any[] = [];

        $('.bbs_ListA tbody tr').each((_, element) => {
            const titleLink = $(element).find('td.bbs_tit a');
            const title = titleLink.text().trim();
            const nttSn = titleLink.attr('data-id');
            const author = $(element).find('td').eq(2).text().trim();
            const date = $(element).find('td').eq(3).text().trim();

            if (nttSn) {
                notices.push({
                    id: nttSn,
                    title,
                    author,
                    date,
                    schoolId: school.id,
                    linkParams: {
                        mi: school.mi,
                        bbsId: school.bbsId,
                        nttSn,
                        sysId: school.sysId,
                    }
                });
            }
        });

        // Parse Pagination info
        // Look for the "End Page" link: <a href="javascript:" onclick="goPaging(28)" class="bbs_arr pgeR2">끝 페이지</a>
        // Or "Next Page" if End Page isn't there (for smaller lists).
        // Actually, we need to find the max page number mentioned in goPaging().

        let totalPages = 1;

        // 1. Try to find the "End Page" link specifically
        const endPageLink = $('.bbs_pagerA .pgeR2').attr('onclick');
        if (endPageLink) {
            const match = endPageLink.match(/goPaging\(([0-9]+)\)/);
            if (match) {
                totalPages = parseInt(match[1], 10);
            }
        } else {
            // 2. If no end page link, find the highest page number link
            $('.bbs_pagerA a').each((_, el) => {
                const onClick = $(el).attr('onclick');
                if (onClick) {
                    const match = onClick.match(/goPaging\(([0-9]+)\)/);
                    if (match) {
                        const p = parseInt(match[1], 10);
                        if (p > totalPages) totalPages = p;
                    }
                }
            });
            // Also check current page if it's higher (e.g. if we are on page 5 and it shows 1..5)
            // .bbs_pge_num strong is current page
            const currentStrong = $('.bbs_pagerA strong.bbs_pge_num').text().trim();
            if (currentStrong) {
                const p = parseInt(currentStrong, 10);
                if (p > totalPages) totalPages = p;
            }
        }

        return NextResponse.json({
            notices,
            pagination: {
                currentPage: parseInt(page as string, 10),
                totalPages
            }
        });
    } catch (error) {
        console.error('Error fetching notices:', error);
        return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 500 });
    }
}
