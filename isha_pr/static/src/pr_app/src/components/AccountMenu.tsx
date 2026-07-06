import { useState } from 'react';
import {
  ActionIcon, Avatar, Badge, Box, Group, Menu, Modal, Stack, Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBuilding, IconCheck, IconExternalLink, IconLogout, IconSettings, IconX,
} from '@tabler/icons-react';
import { usePR } from '../hooks/usePR';
import type { PRMe } from '../types';

const OVERLAY_HEADER_H = 48;

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** Header avatar + account menu. PR users have no self-editable profile
 *  (centers/roles are admin-managed), so this shows identity and role, hosts
 *  the logging-center switcher, and offers backend/logout actions. */
export function AccountMenu({ me }: { me: PRMe }) {
  const { center, setCenter } = usePR();
  const [backendOpen, setBackendOpen] = useState(false);
  const role = me.groups.admin ? 'Admin' : me.groups.global ? 'All Centers' : 'PR User';
  const roleColor = me.groups.admin ? 'clay' : me.groups.global ? 'river' : 'sand';

  return (
    <>
    <Menu shadow="md" position="bottom-end" width={280} withinPortal>
      <Menu.Target>
        <UnstyledButton aria-label="Account">
          <Avatar
            size={32}
            radius="xl"
            color="clay"
            src={`/web/image/res.users/${me.user.id}/avatar_128`}
          >
            {initials(me.user.name)}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Group gap="sm" p="sm" wrap="nowrap">
          <Avatar size={38} radius="xl" color="clay" src={`/web/image/res.users/${me.user.id}/avatar_128`}>
            {initials(me.user.name)}
          </Avatar>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" fw={600} truncate>{me.user.name}</Text>
            <Text size="xs" c="dimmed" truncate>{me.user.login}</Text>
          </Stack>
        </Group>
        <Group gap={4} px="sm" pb="xs">
          <Badge size="xs" variant="light" color={roleColor}>{role}</Badge>
        </Group>

        {me.centers.length > 0 && (
          <>
            <Menu.Divider />
            <Menu.Label>Logging center — new interactions are filed here</Menu.Label>
            {me.centers.map((c) => {
              const active = center?.id === c.id;
              return (
                <Menu.Item
                  key={c.id}
                  leftSection={<IconBuilding size={16} />}
                  rightSection={active ? <IconCheck size={16} color="var(--mantine-color-sage-6)" /> : undefined}
                  onClick={() => setCenter(c)}
                  disabled={me.centers.length === 1}
                >
                  <Text size="sm" fw={active ? 600 : 400}>{c.name}</Text>
                </Menu.Item>
              );
            })}
          </>
        )}

        <Menu.Divider />
        <Menu.Item
          leftSection={<IconSettings size={16} />}
          onClick={() => setBackendOpen(true)}
        >
          Admin configuration
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLogout size={16} />}
          color="red"
          component="a"
          href="/web/session/logout"
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>

    {/* Full-page backend overlay (same-origin iframe) — the sahyog/app
        fullscreen-overlay pattern instead of losing the user to a new tab. */}
    <Modal
      opened={backendOpen}
      onClose={() => setBackendOpen(false)}
      fullScreen
      withCloseButton={false}
      padding={0}
      transitionProps={{ transition: 'fade', duration: 150 }}
    >
      <Group
        justify="space-between"
        px="md"
        style={{
          height: OVERLAY_HEADER_H,
          borderBottom: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-body)',
        }}
      >
        <Group gap={8}>
          <IconSettings size={18} color="var(--mantine-color-dimmed)" />
          <Text fw={600} ff="heading">Admin configuration</Text>
        </Group>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            component="a"
            href="/odoo"
            target="_blank"
            aria-label="Open in new tab"
          >
            <IconExternalLink size={18} />
          </ActionIcon>
          <ActionIcon variant="subtle" onClick={() => setBackendOpen(false)} aria-label="Close">
            <IconX size={20} />
          </ActionIcon>
        </Group>
      </Group>
      {backendOpen && (
        <Box
          component="iframe"
          src="/odoo"
          title="Odoo backend"
          style={{
            display: 'block',
            width: '100%',
            height: `calc(100vh - ${OVERLAY_HEADER_H}px)`,
            border: 'none',
          }}
        />
      )}
    </Modal>
    </>
  );
}
