import { Notice } from '@/types';
import { X, Paperclip, ExternalLink, Download, Link as LinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SCHOOLS } from '@/const/schools';

interface NoticeDetailModalProps {
    notice: Notice;
    isOpen: boolean;
    onClose: () => void;
}

interface NoticeDetail {
    content: string;
    attachments: { name: string; href: string }[];
}

export default function NoticeDetailModal({ notice, isOpen, onClose }: NoticeDetailModalProps) {
    const [detail, setDetail] = useState<NoticeDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !notice) return;

        const controller = new AbortController();
        setLoading(true);
        setError('');
        setDetail(null);

        fetch(`/api/notice-detail?${new URLSearchParams(notice.linkParams)}`, {
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error(`상세 조회 실패 ${res.status}`);
                return res.json();
            })
            .then(setDetail)
            .catch((err) => {
                if (err.name === 'AbortError') return;
                console.error(err);
                setError('공지 내용을 불러오지 못했습니다.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [isOpen, notice]);

    if (!isOpen) return null;

    const copyOriginalLink = () => {
        const { sysId, mi, bbsId, nttSn } = notice.linkParams;
        // Construct the likely original URL. Even if it requires auth/session, it's the "original location".
        // Using selectNttInfo.do as it's the standard view endpoint.
        const originalUrl = `https://school.gyo6.net/${sysId}/na/ntt/selectNttInfo.do?mi=${mi}&bbsId=${bbsId}&nttSn=${nttSn}`;

        navigator.clipboard.writeText(originalUrl).then(() => {
            alert("게시물 원본 링크가 복사되었습니다!");
        }).catch(() => {
            alert("링크 복사에 실패했습니다.");
        });
    };

    const downloadImage = async () => {
        const element = document.getElementById('notice-content-capture');
        if (!element) return;

        try {
            // 이 버튼을 누를 때만 내려받는다 — 첫 화면 청크에 넣을 이유가 없다.
            const { toPng } = await import('html-to-image');

            const dataUrl = await toPng(element, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                width: element.scrollWidth,
                height: element.scrollHeight,
                style: {
                    // Ensure the background is white and text is readable
                    backgroundColor: '#ffffff',
                    // Force full height to start capture
                    overflow: 'visible',
                    maxHeight: 'none',
                    height: 'auto'
                }
            });

            const link = document.createElement('a');
            link.download = `${notice.title}.png`;
            link.href = dataUrl;
            link.click();
            alert("이미지가 저장되었습니다!\n\n네이버 블로그 글쓰기 화면이 열리면 '사진' 버튼을 눌러 저장된 이미지를 업로드하세요.");
        } catch (err) {
            console.error('Failed to capture image:', err);
            alert('이미지 저장에 실패했습니다. (보안 정책 등으로 인해 일부 이미지는 포함되지 않을 수 있습니다)');
        }
    };

    const handleShare = () => {
        // Open Naver Share directly
        const { sysId, mi, bbsId } = notice.linkParams;
        const publicUrl = `https://school.gyo6.net/${sysId}/na/ntt/selectNttList.do?mi=${mi}&bbsId=${bbsId}`;
        const shareUrl = `https://share.naver.com/web/shareView.nhn?url=${encodeURIComponent(publicUrl)}&title=${encodeURIComponent(notice.title)}`;
        window.open(shareUrl, 'naver_share', 'width=500,height=600');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800 line-clamp-1 flex-1 pr-4">
                        {notice.title}
                    </h2>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={copyOriginalLink}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-800"
                            title="게시물 원본 링크 복사"
                        >
                            <LinkIcon size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Container with ID for capture */}
                <div className="flex-1 overflow-y-auto p-6" id="notice-content-capture">
                    {loading && (
                        <div className="flex justify-center items-center h-48">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    )}

                    {error && (
                        <div className="text-red-500 text-center py-10">
                            {error}
                        </div>
                    )}

                    {detail && (
                        <div className="space-y-6 bg-white p-4"> {/* Added bg-white and p-4 for clean capture */}
                            <div className="border-b pb-4 mb-4">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">{notice.title}</h2>
                                <div className="flex items-center text-sm text-gray-700 space-x-4">
                                    <span>{notice.author}</span>
                                    <span>{notice.date}</span>
                                    <span>{SCHOOLS.find(s => s.id === notice.schoolId)?.name}</span>
                                </div>
                            </div>

                            {/* Attachments */}
                            {detail.attachments.length > 0 && (
                                <div className="bg-gray-50 p-4 rounded-md space-y-2 mb-6 border border-gray-100">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                        <Paperclip size={16} /> 첨부파일 (클릭하여 다운로드)
                                    </h4>
                                    {detail.attachments.map((file, idx) => (
                                        <a
                                            key={idx}
                                            href={`/api/download/${encodeURIComponent(file.name)}?url=${encodeURIComponent(file.href)}`}
                                            download={file.name}
                                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline truncate py-1"
                                        >
                                            <Download size={14} className="flex-shrink-0" />
                                            {file.name}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Main Content */}
                            <div
                                className="prose max-w-none dark:prose-invert"
                                dangerouslySetInnerHTML={{ __html: detail.content }}
                            />

                            <div className="mt-8 pt-4 border-t text-right text-sm text-gray-600">
                                출처: {SCHOOLS.find(s => s.id === notice.schoolId)?.name} 공지사항
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t flex justify-end space-x-3 bg-gray-50 rounded-b-lg">
                    <button
                        onClick={downloadImage}
                        disabled={!detail}
                        className="flex items-center gap-2 px-4 py-2 text-gray-900 bg-white border border-gray-400 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        <Download size={18} />
                        이미지로 저장
                    </button>

                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 bg-[#03C75A] text-white rounded-md hover:bg-[#02b150] transition-colors"
                    >
                        <span className="font-bold">N</span> Naver Blog
                        <ExternalLink size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
