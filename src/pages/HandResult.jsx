import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchHandById } from '../api';
import ResultModal from '../components/ResultModal';

/**
 * HandResult - 共有URLからハンド結果を表示するページ
 * URL: /hand/:handId
 */
export default function HandResult() {
    const { handId } = useParams();
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadHand() {
            try {
                setLoading(true);
                const data = await fetchHandById(handId);

                if (!data.ok || !data.hand) {
                    setError('ハンド結果が見つかりませんでした');
                    return;
                }

                setResult({
                    evaluation: data.hand.evaluation,
                    snapshot: data.hand.snapshot,
                    handId: data.hand.hand_id,
                    conversation: data.hand.conversation || []
                });
            } catch (err) {
                console.error('Error loading hand:', err);
                setError('ハンド結果の読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        }

        loadHand();
    }, [handId]);

    const handleClose = () => {
        navigate('/');
    };

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0b1524',
                color: '#fff',
                fontSize: 14
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>読み込み中...</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>ハンドID: {handId}</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0b1524',
                color: '#fff',
                gap: 16
            }}>
                <div style={{ fontSize: 16, color: '#ff7b7b' }}>{error}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>ハンドID: {handId}</div>
                <button
                    className="btn"
                    onClick={() => navigate('/')}
                    style={{ marginTop: 8 }}
                >
                    ホームに戻る
                </button>
            </div>
        );
    }

    return (
        <ResultModal
            open={true}
            onClose={handleClose}
            result={result}
            followupsPerHand={null}
            followupsUsed={0}
            onFollowupUsage={() => { }}
        />
    );
}
