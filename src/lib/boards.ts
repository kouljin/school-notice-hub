import { SCHOOLS } from '@/const/schools';
import { ORIGIN } from '@/lib/gyo6/fetch';

export interface BoardRef {
    key: string;
    schoolId: string;
    schoolName: string;
    sysId: string;
    boardId: string;
    boardName: string;
    mi: string;
    bbsId: string;
}

// Firestore 문서 ID. sysId는 영숫자, bbsId는 숫자로 검증되므로 '/'가 섞일 수 없다.
export const boardKey = (sysId: string, bbsId: string) => `${sysId}_${bbsId}`;

export const listUrl = (b: Pick<BoardRef, 'sysId' | 'mi' | 'bbsId'>) =>
    `${ORIGIN}/${b.sysId}/na/ntt/selectNttList.do?mi=${b.mi}&bbsId=${b.bbsId}`;

export const noticeUrl = (b: Pick<BoardRef, 'sysId' | 'mi' | 'bbsId'>, nttSn: string) =>
    `${ORIGIN}/${b.sysId}/na/ntt/selectNttInfo.do?mi=${b.mi}&bbsId=${b.bbsId}&nttSn=${nttSn}`;

// 알림을 눌렀을 때 열 주소. 원본 학교 사이트가 아니라 우리 앱으로 들어와야
// 홈 화면에 설치된 PWA가 그대로 뜨고 첨부·본문을 앱 안에서 볼 수 있다.
export const appNoticePath = (b: Pick<BoardRef, 'schoolId' | 'boardId'>, nttSn: string) =>
    `/?school=${encodeURIComponent(b.schoolId)}&board=${encodeURIComponent(b.boardId)}&ntt=${encodeURIComponent(nttSn)}`;

// 설정의 학교 목록을 크론이 순회할 평평한 게시판 목록으로 편다.
export function boardsFromConfig(): BoardRef[] {
    return SCHOOLS.flatMap((school) =>
        (school.boards ?? []).map((board) => ({
            key: boardKey(school.sysId, board.bbsId),
            schoolId: school.id,
            schoolName: school.name,
            sysId: school.sysId,
            boardId: board.id,
            boardName: board.name,
            mi: board.mi,
            bbsId: board.bbsId,
        })),
    );
}
