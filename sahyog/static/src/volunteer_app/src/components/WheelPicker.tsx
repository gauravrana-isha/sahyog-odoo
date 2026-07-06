import { useEffect, useRef, type ReactNode } from 'react';
import { Box, Button, Drawer, Group, Modal, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

/**
 * Shared iOS-style wheel-picker machinery used by TimePicker and
 * DatePickerField: snap-scrolling columns, the selection band + edge fades,
 * commit actions, and the responsive bottom-sheet/modal container.
 */

export const ITEM_H = 40;
const VISIBLE = 5; // odd, so one row sits exactly in the middle
export const PAD = ITEM_H * Math.floor(VISIBLE / 2);
export const WHEEL_H = ITEM_H * VISIBLE;
// Looping wheels render the item list this many times and recenter to the
// middle copy after each settle, so the user can spin past the end forever.
const REPEAT = 5;
const MID_COPY = Math.floor(REPEAT / 2);

export const MOBILE_QUERY = '(max-width: 768px)';

interface WheelProps {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  loop?: boolean;
}

/** One snap-scrolling column. Selection = whatever row settles in the middle;
 *  tapping a row scrolls it there. With `loop`, the list wraps around. */
export function Wheel({ items, value, onChange, ariaLabel, loop = false }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const programmatic = useRef(false);

  const len = items.length;
  const index = Math.max(0, items.indexOf(value));
  const copies = loop ? REPEAT : 1;
  const homeIndex = loop ? MID_COPY * len + index : index;

  const jumpTo = (globalIndex: number) => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTop = globalIndex * ITEM_H;
    requestAnimationFrame(() => { programmatic.current = false; });
  };

  // Keep the wheel aligned with the controlled value (mount + external changes).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = Math.round(el.scrollTop / ITEM_H);
    if (current % len === index && Math.abs(el.scrollTop - current * ITEM_H) <= 1) return;
    jumpTo(homeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, len]);

  const handleScroll = () => {
    if (programmatic.current) return;
    window.clearTimeout(settleTimer.current);
    // Fires once momentum + snap have settled (scroll events stop arriving).
    settleTimer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const g = Math.min(copies * len - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      const item = items[g % len];
      // Seamlessly recenter to the middle copy so there is always runway.
      if (loop && (g < len || g >= (copies - 1) * len)) {
        jumpTo(MID_COPY * len + (g % len));
      }
      if (item !== value) {
        navigator.vibrate?.(4); // soft tick where supported (Android)
        onChange(item);
      }
    }, 150);
  };

  return (
    <Box
      ref={ref}
      className="sahyog-wheel"
      role="listbox"
      aria-label={ariaLabel}
      onScroll={handleScroll}
      style={{
        height: WHEEL_H,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        paddingTop: PAD,
        paddingBottom: PAD,
        flex: 1,
        overscrollBehavior: 'contain',
      }}
    >
      {Array.from({ length: copies * len }, (_, g) => {
        const item = items[g % len];
        const selected = g % len === index;
        return (
          <UnstyledButton
            key={g}
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            onClick={() => ref.current?.scrollTo({ top: g * ITEM_H, behavior: 'smooth' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: ITEM_H,
              scrollSnapAlign: 'center',
              fontSize: 'var(--mantine-font-size-lg)',
              fontWeight: selected ? 600 : 400,
              color: selected ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)',
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 100ms ease',
            }}
          >
            {item}
          </UnstyledButton>
        );
      })}
    </Box>
  );
}

/** Frames a row of wheels with the shared selection band and edge fades. */
export function WheelFrame({ children, maxWidth = 280 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <Box style={{ position: 'relative', maxWidth, margin: '0 auto' }}>
      <Box
        style={{
          position: 'absolute',
          top: PAD,
          left: 0,
          right: 0,
          height: ITEM_H,
          borderRadius: 'var(--mantine-radius-md)',
          backgroundColor: 'var(--mantine-color-clay-light)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Group gap={0} wrap="nowrap" style={{ position: 'relative' }}>
        {children}
      </Group>
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: PAD,
          background: 'linear-gradient(var(--mantine-color-body) 25%, transparent)',
          pointerEvents: 'none',
        }}
      />
      <Box
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: PAD,
          background: 'linear-gradient(transparent, var(--mantine-color-body) 75%)',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}

/** Cancel / commit footer shared by all wheel pickers. */
export function PickerActions({ onCancel, onCommit, commitLabel }: { onCancel: () => void; onCommit: () => void; commitLabel: string }) {
  return (
    <Group grow mt="md" gap="sm">
      <Button variant="default" size="md" radius="md" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="md" radius="md" onClick={onCommit}>
        {commitLabel}
      </Button>
    </Group>
  );
}

/** Bottom sheet on mobile, centered card modal on desktop. */
export function PickerSheet({ opened, onClose, children }: { opened: boolean; onClose: () => void; children: ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        size={480}
        withCloseButton={false}
        padding="lg"
        styles={{
          content: {
            borderTopLeftRadius: 'var(--mantine-radius-xl)',
            borderTopRightRadius: 'var(--mantine-radius-xl)',
          },
          body: {
            paddingBottom: 'calc(var(--mantine-spacing-lg) + env(safe-area-inset-bottom, 0px))',
          },
        }}
      >
        {/* Drag-handle affordance */}
        <Box
          w={36}
          h={4}
          mx="auto"
          mb="md"
          style={{ borderRadius: 999, backgroundColor: 'var(--mantine-color-gray-3)' }}
        />
        {children}
      </Drawer>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={360}
      radius="lg"
      withCloseButton={false}
      padding="lg"
    >
      {children}
    </Modal>
  );
}
