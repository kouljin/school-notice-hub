import { Notice } from '@/types';
import { Calendar, User } from 'lucide-react';

interface NoticeListProps {
    notices: Notice[];
    loading: boolean;
    onSelectNotice: (notice: Notice) => void;
}

export default function NoticeList({ notices, loading, onSelectNotice }: NoticeListProps) {
    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center p-4 border rounded-lg bg-gray-50">
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (notices.length === 0) {
        return <div className="text-center py-10 text-gray-500">No notices found.</div>;
    }

    return (
        <div className="space-y-3">
            {notices.map((notice) => (
                <div
                    key={notice.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow bg-white gap-4"
                >
                    <div className="flex-1 cursor-pointer" onClick={() => onSelectNotice(notice)}>
                        <h3 className="text-lg font-medium text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                            {notice.title}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                            <span className="flex items-center gap-1">
                                <User size={14} />
                                {notice.author}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                {notice.date}
                            </span>
                        </div>
                    </div>

                </div>
            ))}
        </div>
    );
}
