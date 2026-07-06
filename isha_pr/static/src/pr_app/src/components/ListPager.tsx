import { ActionIcon, Group, Pagination, Select, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

const PAGE_SIZES = ['25', '50', '100'];

interface ListPagerProps {
  total: number;
  offset: number;
  limit: number;
  /** Called with the new offset and page size. */
  onChange: (offset: number, limit: number) => void;
}

/** Standard pager row for server-paginated lists. Desktop: full page
 *  numbers + page-size select. Mobile: compact prev / "2 of 7" / next so
 *  nothing wraps. Renders nothing when one page suffices. */
export function ListPager({ total, offset, limit, onChange }: ListPagerProps) {
  const isWide = useMediaQuery('(min-width: 768px)');
  if (total <= Math.min(limit, 25)) {
    return null;
  }
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const goTo = (p: number) => onChange((p - 1) * limit, limit);

  return (
    <Group justify="space-between" mt="md" wrap="nowrap" gap="xs">
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {from}–{to} of {total}
      </Text>
      {isWide ? (
        <Group gap="xs" wrap="nowrap">
          <Pagination
            size="sm"
            value={page}
            total={pages}
            siblings={1}
            boundaries={1}
            onChange={goTo}
          />
          <Select
            size="xs"
            w={80}
            aria-label="Page size"
            data={PAGE_SIZES}
            value={String(limit)}
            onChange={(v) => v && onChange(0, parseInt(v, 10))}
          />
        </Group>
      ) : (
        <Group gap={6} wrap="nowrap">
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
            {page} / {pages}
          </Text>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => goTo(page + 1)}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      )}
    </Group>
  );
}
