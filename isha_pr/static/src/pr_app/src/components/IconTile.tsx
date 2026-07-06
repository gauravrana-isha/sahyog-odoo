import type { ComponentType } from 'react';
import { Center } from '@mantine/core';

interface IconTileProps {
  icon: ComponentType<{ size?: number | string; stroke?: number | string; color?: string }>;
  /** Mantine palette name (clay, sage, ochre, river, sand). */
  color: string;
  size?: number;
}

/** Rounded tinted icon tile — the leading visual for entity cards.
 *  Uses the -light/-light-color vars so it adapts to both color schemes. */
export function IconTile({ icon: Icon, color, size = 40 }: IconTileProps) {
  return (
    <Center
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 'var(--mantine-radius-md)',
        backgroundColor: `var(--mantine-color-${color}-light)`,
      }}
    >
      <Icon size={size * 0.55} stroke={1.8} color={`var(--mantine-color-${color}-light-color)`} />
    </Center>
  );
}
