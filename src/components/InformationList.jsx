import React, { useEffect, useState } from "react";

function InformationList() {
    const [information, setInformation] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadInformation();
    }, []);

    async function loadInformation() {
        try {
            const res = await fetch('./announcements.json?_t=' + Date.now());
            if (!res.ok) {
                throw new Error('Failed to load announcements');
            }
            const data = await res.json();
            setInformation(data.information || []);
        } catch (err) {
            console.error('Error loading information:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div style={{
                padding: 32,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 13
            }}>
                読み込み中...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                padding: 32,
                textAlign: 'center',
                color: '#ff7b7b',
                fontSize: 13
            }}>
                お知らせの読み込みに失敗しました
            </div>
        );
    }

    if (information.length === 0) {
        return (
            <div style={{
                padding: 32,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 13
            }}>
                お知らせはありません
            </div>
        );
    }

    return (
        <div style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '16px 0'
        }}>
            {information.map((info) => (
                <div
                    key={info.id}
                    style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 8
                    }}>
                        <span style={{
                            fontSize: 12,
                            color: '#00d4ff',
                            fontFamily: 'monospace',
                            fontWeight: 500,
                            flexShrink: 0
                        }}>
                            {info.date}
                        </span>
                        <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#eef4ff'
                        }}>
                            {info.title}
                        </span>
                    </div>
                    {info.message && (
                        <div style={{
                            fontSize: 13,
                            color: '#94a3b8',
                            lineHeight: 1.6,
                            marginLeft: 0
                        }}>
                            {info.message}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default InformationList;
