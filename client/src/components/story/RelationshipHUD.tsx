import React from 'react';

interface Relation { npcId: string; value: number }
interface Props { relations?: Relation[] }

const clamp = (v:number) => Math.max(-100, Math.min(100, v));

const RelationRow: React.FC<Relation> = ({ npcId, value }) => {
  const v = clamp(value);
  const pos = v > 0; const width = Math.abs(v);
  return (
    <div className="mb-2">
      <div className="text-xs text-gray-300 mb-1 flex justify-between">
        <span>{npcId}</span>
        <span className={pos ? 'text-emerald-400' : 'text-rose-400'}>{v}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded overflow-hidden">
        <div className={`${pos ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${width}%`, height: '100%' }} />
      </div>
    </div>
  );
};

export const RelationshipHUD: React.FC<Props> = ({ relations }) => {
  if (!relations || relations.length === 0) return null;
  return (
    <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-2">人物关系</div>
      {relations.map((r, i) => <RelationRow key={`${r.npcId}-${i}`} {...r} />)}
    </div>
  );
};

export default RelationshipHUD;
