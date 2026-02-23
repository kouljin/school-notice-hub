import { School } from '@/types';

export type SchoolConfig = School;

export const SCHOOLS: SchoolConfig[] = [
  {
    id: 'cheongdoms',
    name: '청도중학교',
    sysId: 'cheongdoms',
    mi: '108947',
    bbsId: '39256',
    boards: [
      { id: 'notice', name: '공지사항', mi: '108947', bbsId: '39256' },
      { id: 'family_letter', name: '가정통신문', mi: '108948', bbsId: '39257' }
    ]
  },
  {
    id: 'cheongdohs',
    name: '청도고등학교',
    sysId: 'cheongdohs',
    mi: '109736',
    bbsId: '31713',
    boards: [
      { id: 'notice', name: '공지사항', mi: '109736', bbsId: '31713' },
      { id: 'family_letter', name: '가정통신문', mi: '109737', bbsId: '31714' },
      { id: 'eval_plan', name: '평가계획', mi: '109795', bbsId: '31762' }
    ]
  },
  {
    id: 'mogyems',
    name: '모계중학교',
    sysId: 'mogyems',
    mi: '153653',
    bbsId: '20670',
    boards: [
      { id: 'notice', name: '공지사항', mi: '153653', bbsId: '20670' },
      { id: 'family_letter', name: '가정통신문', mi: '153654', bbsId: '20671' }
    ]
  },
  {
    id: 'mogyehs',
    name: '모계고등학교',
    sysId: 'mogyehs',
    mi: '153517',
    bbsId: '74398',
    boards: [
      { id: 'notice', name: '공지사항', mi: '153517', bbsId: '74398' },
      { id: 'family_letter', name: '가정통신문', mi: '153518', bbsId: '74401' }
    ]
  },
  {
    id: 'eseoms',
    name: '이서중학교',
    sysId: 'eseoms',
    mi: '119120',
    bbsId: '71156',
    boards: [
      { id: 'notice', name: '공지사항', mi: '119120', bbsId: '71156' },
      { id: 'family_letter', name: '가정통신문', mi: '119121', bbsId: '71148' }
    ]
  },
  {
    id: 'eseohhs',
    name: '이서고등학교',
    sysId: 'eseohhs',
    mi: '119047',
    bbsId: '22188',
    boards: [
      { id: 'notice', name: '공지사항', mi: '119047', bbsId: '22188' },
      { id: 'family_letter', name: '가정통신문', mi: '119048', bbsId: '22187' },
      { id: 'eval_plan', name: '평가계획', mi: '118994', bbsId: '53263' }
    ]
  },
  {
    id: 'maejunms',
    name: '매전중학교',
    sysId: 'maejunms',
    mi: '152835',
    bbsId: '33820',
    boards: [
      { id: 'notice', name: '공지사항', mi: '152835', bbsId: '33820' },
      { id: 'family_letter', name: '가정통신문', mi: '152836', bbsId: '33821' }
    ]
  },
];
