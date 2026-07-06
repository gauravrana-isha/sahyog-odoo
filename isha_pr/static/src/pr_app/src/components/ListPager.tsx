import { Group, Pagination, Select, Text } from '@mantine/core';

const PAGE_SIZES = ['25', '50', '100'];

interface ListPagerProps {
  total: number;
  offset: number;
  limit: number;
  /** Called with the new offset and page size. */
  onChange: (offset: number, limit: number) => void;
}

/** Standard pager row for server-paginated lists: range text, page controls,
 *  page-size select. Renders nothing when one page suffices. */
export function ListPager({ total, offset, limit, onChange }: ListPagerProps) {
  if (total <= Math.min(limit, 25)) {
    return null;
  }
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <Group justify="space-between" mt="md" wrap="wrap" gap="xs">
      <Text size="xs" c="dimmed">{from}–{to} of {total}</Text>
      <Group gap="xs" wrap="nowrap">
        <Pagination
          size="sm"
          value={page}
          total={pages}
          onChange={(p) => onChange((p - 1) * limit, limit)}
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
    </Group>
  );
}
