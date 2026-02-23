export interface Board {
    id: string; // unique identifier for the board (e.g., 'notice', 'family_letter')
    name: string; // display name (e.g., '공지사항', '가정통신문')
    mi: string;
    bbsId: string;
}

// School configuration interface
export interface School {
    id: string;
    name: string;
    sysId: string; // System ID in URL (e.g. cheongdoms)

    // Default board (usually Notice)
    mi: string;    // Menu ID
    bbsId: string; // Board ID

    // Additional boards for this school
    boards?: Board[];
}

export interface Notice {
    id: string;
    title: string;
    author: string;
    date: string;
    schoolId: string;
    linkParams: {
        mi: string;
        bbsId: string;
        nttSn: string;
        sysId: string;
    };
}
