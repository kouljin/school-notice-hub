import { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { School } from '@/types';

interface AddSchoolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (school: School) => void;
}

export default function AddSchoolModal({ isOpen, onClose, onAdd }: AddSchoolModalProps) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Please enter a school name.');
            return;
        }

        if (!url.trim()) {
            setError('Please enter the notice board URL.');
            return;
        }

        // Parse URL
        // Expected format: https://school.gyo6.net/cheongdoms/na/ntt/selectNttList.do?mi=108947&bbsId=39256
        try {
            const urlObj = new URL(url);

            // Extract sysId from path (e.g., /cheongdoms/...)
            const pathParts = urlObj.pathname.split('/');
            // pathParts[0] is empty, pathParts[1] should be sysId
            const sysId = pathParts[1];

            const mi = urlObj.searchParams.get('mi');
            const bbsId = urlObj.searchParams.get('bbsId');

            if (!sysId || !mi || !bbsId) {
                setError('Invalid URL format. Could not extract School ID, MI, or BBS ID.');
                return;
            }

            const newSchool: School = {
                id: sysId, // Use sysId as unique ID for now, or generate a UUID if needed. sysId is usually unique enough for this context.
                name: name.trim(),
                sysId,
                mi,
                bbsId
            };

            onAdd(newSchool);
            onClose();
            setName('');
            setUrl('');
        } catch (err) {
            setError('Invalid URL. Please enter a valid URL starting with http:// or https://');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">Add School</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            School Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. My School"
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notice Board URL
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://school.gyo6.net/..."
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Navigate to the school's notice list page and copy the URL.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Check size={16} />
                            Add School
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
