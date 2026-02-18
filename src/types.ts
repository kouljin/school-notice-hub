// School configuration interface
export interface School {
    id: string;
    name: string;
    sysId: string; // System ID in URL (e.g. cheongdoms)
    mi: string;    // Menu ID
    bbsId: string; // Board ID
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
