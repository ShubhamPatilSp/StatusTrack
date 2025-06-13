'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, UserPlus, Trash2, Edit, Save, X, Shield, User } from 'lucide-react';
import { InviteMemberModal } from './InviteMemberModal';

interface Member {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: 'ADMIN' | 'MEMBER' | 'OWNER';
}

interface OrganizationData {
  id: string;
  name: string;
  members: Member[];
}

const orgUpdateSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
});

type OrgUpdateFormData = z.infer<typeof orgUpdateSchema>;

const OrganizationSettingsPage = ({ organizationId }: { organizationId: string }) => {
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<OrgUpdateFormData>({
    resolver: zodResolver(orgUpdateSchema),
  });

  const fetchOrganization = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/organizations/${organizationId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch organization data');
      }
      const data = await response.json();
      setOrganization(data);
      setValue('name', data.name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, setValue]);

  useEffect(() => {
    if (organizationId) {
      fetchOrganization();
    }
  }, [organizationId, fetchOrganization]);

  const handleUpdateName = async (data: OrgUpdateFormData) => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update organization name');
      }
      const updatedOrg = await response.json();
      setOrganization(updatedOrg);
      setValue('name', updatedOrg.name);
      setIsEditingName(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  if (error) {
    return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md" role="alert"><strong>Error:</strong> {error}</div>;
  }

  if (!organization) {
    return <div className="text-center p-4 text-gray-500">Organization not found.</div>;
  }

  const handleMemberAdded = () => {
    fetchOrganization(); // Re-fetch data to show the new member
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return;
    }

    setRemovingMemberId(memberId);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to remove member');
      }

      // Update the state to remove the member from the list
      setOrganization(prev => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.filter(m => m.id !== memberId),
        };
      });

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <>
      <InviteMemberModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setInviteModalOpen(false)} 
        onMemberAdded={handleMemberAdded}
        organizationId={organizationId}
      />
      <div className="space-y-10">
        {/* General Settings Card */}
        <div className="bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-5">General</h2>
          <form onSubmit={handleSubmit(handleUpdateName)} className="space-y-4">
              <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization Name</label>
                  <div className="mt-1 flex items-center gap-2">
                      <input 
                          {...register('name')} 
                          id="name" 
                          className="w-full max-w-md px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 transition-all duration-200"
                          disabled={!isEditingName}
                      />
                      {!isEditingName ? (
                          <button type="button" onClick={() => setIsEditingName(true)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><Edit className='w-5 h-5' /></button>
                      ) : (
                          <div className='flex items-center gap-2'>
                              <button type="submit" disabled={isSubmitting} className="p-2 rounded-md bg-green-500 text-white hover:bg-green-600 disabled:bg-green-400">
                                  {isSubmitting ? <Loader2 className='w-5 h-5 animate-spin' /> : <Save className='w-5 h-5' />}
                              </button>
                              <button type="button" onClick={() => setIsEditingName(false)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><X className='w-5 h-5' /></button>
                          </div>
                      )}
                  </div>
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>
          </form>
        </div>

        {/* Members Card */}
        <div className="bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold">Members</h2>
              <button onClick={() => setInviteModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                  <UserPlus className="h-4 w-4" /> Invite Member
              </button>
          </div>
          <div className="flow-root">
              <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                  {organization.members.map((member) => (
                      <li key={member.id} className="py-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                              <img className="h-10 w-10 rounded-full" src={member.picture || '/default-avatar.png'} alt="" />
                              <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                  {member.role === 'OWNER' && <Shield className="w-4 h-4 mr-1.5 text-yellow-500"/>}
                                  {member.role === 'ADMIN' && <User className="w-4 h-4 mr-1.5 text-blue-500"/>}
                                  {member.role}
                              </span>
                              {member.role !== 'OWNER' && (
                                  <button 
                                    onClick={() => handleRemoveMember(member.id)}
                                    disabled={removingMemberId === member.id}
                                    className="p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                      {
                                    removingMemberId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />
                                  }
                                  </button>
                              )}
                          </div>
                      </li>
                  ))}
              </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrganizationSettingsPage;
