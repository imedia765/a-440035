import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion } from "@/components/ui/accordion";
import { useState } from "react";
import CollectorPaymentSummary from './CollectorPaymentSummary';
import MemberCard from './members/MemberCard';
import PaymentDialog from './members/PaymentDialog';
import { Member } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { generateMembersPDF } from '@/utils/pdfGenerator';

interface MembersListProps {
  searchTerm: string;
  userRole: string | null;
}

const ITEMS_PER_PAGE = 10;

const MembersList = ({ searchTerm, userRole }: MembersListProps) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: collectorInfo } = useQuery({
    queryKey: ['collector-info'],
    queryFn: async () => {
      if (userRole !== 'collector') return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: collectorData } = await supabase
        .from('members_collectors')
        .select('name')
        .eq('member_number', user.user_metadata.member_number)
        .single();

      return collectorData;
    },
    enabled: userRole === 'collector',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['members', searchTerm, userRole, currentPage],
    queryFn: async () => {
      console.log('Fetching members with search term:', searchTerm);
      let query = supabase
        .from('members')
        .select('*', { count: 'exact' });
      
      // Add search filter if search term exists
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,member_number.ilike.%${searchTerm}%,collector.ilike.%${searchTerm}%`);
      }

      // Add collector filter for collector role
      if (userRole === 'collector') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: collectorData } = await supabase
            .from('members_collectors')
            .select('name')
            .eq('member_number', user.user_metadata.member_number)
            .single();

          if (collectorData?.name) {
            console.log('Filtering members for collector:', collectorData.name);
            query = query.eq('collector', collectorData.name);
          }
        }
      }
      
      // Add pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error('Error fetching members:', error);
        throw error;
      }
      
      console.log('Members query result:', data);
      return {
        members: data as Member[],
        totalCount: count || 0
      };
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    keepPreviousData: true, // Keep previous data while fetching new data
  });

  const totalPages = Math.ceil((membersData?.totalCount || 0) / ITEMS_PER_PAGE);
  const members = membersData?.members || [];
  const selectedMember = members?.find(m => m.id === selectedMemberId);

  const handlePrintMembers = () => {
    if (!members?.length || !collectorInfo?.name) {
      toast({
        title: "Error",
        description: "No members available to print",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = generateMembersPDF(members, `Members List - Collector: ${collectorInfo.name}`);
      doc.save();
      toast({
        title: "Success",
        description: "PDF report generated successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {userRole === 'collector' && members && members.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button
            onClick={handlePrintMembers}
            className="flex items-center gap-2 bg-dashboard-accent1 hover:bg-dashboard-accent1/80"
          >
            <Printer className="w-4 h-4" />
            Print Members List
          </Button>
        </div>
      )}

      <ScrollArea className="h-[600px] w-full rounded-md">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent1"></div>
          </div>
        ) : (
          <>
            <Accordion type="single" collapsible className="space-y-4">
              {members?.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  userRole={userRole}
                  onPaymentClick={() => setSelectedMemberId(member.id)}
                />
              ))}
            </Accordion>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6 pb-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="bg-dashboard-card border-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-dashboard-text">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="bg-dashboard-card border-white/10"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {selectedMember && (
        <PaymentDialog
          isOpen={!!selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
          memberId={selectedMember.id}
          memberNumber={selectedMember.member_number}
          memberName={selectedMember.full_name}
          collectorInfo={collectorInfo}
        />
      )}

      {userRole === 'collector' && collectorInfo && (
        <CollectorPaymentSummary collectorName={collectorInfo.name} />
      )}
    </div>
  );
};

export default MembersList;