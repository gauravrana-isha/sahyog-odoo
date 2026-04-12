import { Tooltip } from '@mantine/core';
import type { BarData } from '../utils/gantt';
import { ENTRY_COLORS } from '../utils/gantt';
import { GanttTooltipContent } from './GanttTooltip';

interface GanttBarProps {
  bar: BarData;
  totalDays: number;
}

export function GanttBar({ bar, totalDays }: GanttBarProps) {
  const color = ENTRY_COLORS[bar.entry.entry_type] || '#999';
  const leftPct = (bar.startCol / totalDays) * 100;
  const widthPct = (bar.spanCols / totalDays) * 100;

  // Extract the label after " — " if present
  const parts = bar.entry.name.split(' — ');
  const label = parts.length > 1 ? parts[1] : bar.entry.name;

  return (
    <Tooltip
      label={<GanttTooltipContent entry={bar.entry} />}
      position="top"
      withArrow
      multiline
      w={220}
    >
      <div
        style={{
          position: 'absolute',
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          top: bar.laneIndex * 26 + 4,
          height: 22,
          backgroundColor: color,
          borderRadius: 4,
          color: '#fff',
          fontSize: 11,
          lineHeight: '22px',
          paddingLeft: 6,
          paddingRight: 4,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          cursor: 'default',
          boxSizing: 'border-box',
        }}
      >
        {label}
      </div>
    </Tooltip>
  );
}
