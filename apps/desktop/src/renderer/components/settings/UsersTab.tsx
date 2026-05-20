import { useState, useEffect, useCallback } from 'react';
import type { User, UserRole } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Select, Badge } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import styles from './UsersTab.module.css';

interface Props {
  currentUserId: string;
}

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'baker', label: 'Baker' },
];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  owner: 'Owner',
  cashier: 'Cashier',
  baker: 'Baker',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  role: 'cashier' as UserRole,
  password: '',
};

type Mode = 'add' | 'edit' | 'reset' | null;

export function UsersTab({ currentUserId }: Props) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(true);

  const [mode, setMode] = useState<Mode>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetPassword, setResetPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: User[]; total: number }>(
        `/users?page=${page}&limit=${limit}&includeInactive=${includeInactive}`,
      );
      setUsers(res.data);
      setTotal(res.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load users', 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, includeInactive, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAdd = () => {
    setMode('add');
    setEditingUser(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (user: User) => {
    setMode('edit');
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
    });
  };

  const openReset = (user: User) => {
    setMode('reset');
    setEditingUser(user);
    setResetPassword('');
  };

  const closeModal = () => {
    setMode(null);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setResetPassword('');
  };

  const handleSubmitAdd = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      showToast('Name, email, and password are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
      });
      showToast('User created. They must change their password on first login.', 'success');
      closeModal();
      fetchUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await api.patch(`/users/${editingUser.id}`, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      });
      showToast('User updated');
      closeModal();
      fetchUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReset = async () => {
    if (!editingUser) return;
    if (resetPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${editingUser.id}/reset-password`, {
        newPassword: resetPassword,
      });
      showToast(`Password reset for ${editingUser.name}. They must change it on next login.`, 'success');
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reset failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUserId) {
      showToast("You can't deactivate your own account", 'error');
      return;
    }
    const activating = !user.isActive;
    if (!activating && !window.confirm(`Deactivate ${user.name}? They won't be able to log in.`)) {
      return;
    }
    try {
      await api.patch(`/users/${user.id}`, { isActive: activating });
      showToast(activating ? 'User activated' : 'User deactivated');
      fetchUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    }
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <div className={styles.nameCell}>
          <span className={styles.name}>{row.name}</span>
          {row.id === currentUserId && <span className={styles.youChip}>You</span>}
          {row.mustChangePassword && (
            <span className={styles.mustChip} title="Must change password on next login">
              Reset pending
            </span>
          )}
        </div>
      ),
    },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (row) => <span className={styles.rolePill}>{ROLE_LABEL[row.role]}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'danger'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={(e) => { e.stopPropagation(); openReset(row); }}
          >
            Reset password
          </button>
          <button
            type="button"
            className={row.isActive ? styles.actionBtnDanger : styles.actionBtn}
            onClick={(e) => { e.stopPropagation(); handleToggleActive(row); }}
            disabled={row.id === currentUserId && row.isActive}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => { setIncludeInactive(e.target.checked); setPage(1); }}
          />
          Show inactive
        </label>
        <Button onClick={openAdd}>＋ Add User</Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage="No users yet."
      />

      {totalPages > 1 && (
        <div className={styles.pagerWrap}>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Add user */}
      <Modal isOpen={mode === 'add'} onClose={closeModal} title="Add User" size="md">
        <div className={styles.form}>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          />
          <Input
            label="Initial password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Minimum 6 characters"
          />
          <p className={styles.formNote}>
            The user will be forced to change this password on their first login.
          </p>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmitAdd} loading={saving}>Create user</Button>
          </div>
        </div>
      </Modal>

      {/* Edit user */}
      <Modal isOpen={mode === 'edit' && !!editingUser} onClose={closeModal} title={`Edit ${editingUser?.name ?? ''}`} size="md">
        <div className={styles.form}>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            disabled={editingUser?.id === currentUserId}
          />
          {editingUser?.id === currentUserId && (
            <p className={styles.formNote}>You can&rsquo;t change your own role.</p>
          )}
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmitEdit} loading={saving}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* Reset password */}
      <Modal isOpen={mode === 'reset' && !!editingUser} onClose={closeModal} title={`Reset password — ${editingUser?.name ?? ''}`} size="sm">
        <div className={styles.form}>
          <Input
            label="New temporary password"
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="Minimum 6 characters"
          />
          <p className={styles.formNote}>
            Share this password securely. {editingUser?.name ?? 'The user'} will be forced
            to change it on their next login.
          </p>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmitReset} loading={saving}>Reset password</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
