import { Group, Stack, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import type { SourceLink } from '../types';

/** Parse the `source_links` JSON blob (ordered [{n,title,url}]) the AI evaluation
 *  stores. Shared by the collaboration and nomination detail views so inline [n]
 *  citations map to a real, clickable source list. */
export function parseSourceLinks(raw: string): SourceLink[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((s) => s && (s.title || s.url)) : [];
  } catch { return []; }
}

function prettyHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function SourceLinksList({ sources }: { sources: SourceLink[] }) {
  return (
    <Stack gap={6}>
      {sources.map((s) => (
        <Group key={s.n} gap={8} wrap="nowrap" align="flex-start">
          <Text size="xs" fw={700} c="clay" style={{ minWidth: 22 }}>[{s.n}]</Text>
          {s.url ? (
            <Text size="xs" component="a" href={s.url} target="_blank" rel="noopener noreferrer"
              c="river" style={{ wordBreak: 'break-word' }}>
              {s.title || prettyHost(s.url)}
              <IconExternalLink size={11} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
            </Text>
          ) : (
            <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>{s.title}</Text>
          )}
        </Group>
      ))}
    </Stack>
  );
}
