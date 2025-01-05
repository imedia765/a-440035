import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Member } from "@/types/member";
import { Loader2 } from "lucide-react";

const CollectorMembers = ({ collectorName }: { collectorName: string }) => {
  // Log authentication and role information for debugging
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current auth user:', user);
      
      if (user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        console.log('User roles:', roles);
      }
    };
    
    checkAuth();
  }, []);

  // Simplified query to fetch members
  const { data: members, isLoading, error } = useQuery({
    queryKey: ['collectorMembers', collectorName],
    queryFn: async () => {
      console.log('Fetching members for collector:', collectorName);
      
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('collector', collectorName);

      if (error) {
        console.error('Error fetching members:', error);
        throw error;
      }

      console.log('Members data:', data);
      return data as Member[];
    },
    enabled: !!collectorName,
  });

  // Basic loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Error handling
  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading members: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  // No data state
  if (!members || members.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        No members found for collector: {collectorName}
      </div>
    );
  }

  // Simplified member list rendering
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {members.map((member) => (
          <li 
            key={member.id}
            className="bg-card p-4 rounded-lg border border-border"
          >
            <div>
              <p className="font-medium">{member.full_name}</p>
              <p className="text-sm text-muted-foreground">
                Member #: {member.member_number}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CollectorMembers;