import TeachingTeamPanel from './TeachingTeamPanel';
import type { Class } from '@/types/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Users } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  classData: Class;
  currentUserId?: string;
  isAdmin?: boolean;
  onUpdated: (cls: Class) => void;
};

/** Modal for lead instructors to view the team and invite support instructors. */
export default function TeachingTeamModal({
  open,
  onOpenChange,
  classId,
  classData,
  onUpdated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-[#e4dfd6] bg-[#faf8f5] p-0 gap-0 rounded-none max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#eee9e0]">
          <DialogTitle className="flex items-center gap-2 font-serif text-xl text-[#14110e]">
            <Users className="h-5 w-5" />
            Instructors
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6b655c] text-left">
            Assign approved instructors from their portfolios. Lead creates the class; up to 2
            support instructors can be invited.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">
          <TeachingTeamPanel
            classId={classId}
            classData={classData}
            onClassUpdated={onUpdated}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
