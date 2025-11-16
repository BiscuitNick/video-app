import { Scissors, Copy, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'

interface TimelineToolbarProps {
  hasSelection: boolean
  onSplitAtPlayhead: () => void
  onDuplicateClips: () => void
  onDeleteClips: () => void
}

export function TimelineToolbar({
  hasSelection,
  onSplitAtPlayhead,
  onDuplicateClips,
  onDeleteClips,
}: TimelineToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border-b border-zinc-700">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSplitAtPlayhead}
              disabled={!hasSelection}
              className="h-8 px-2"
            >
              <Scissors className="w-4 h-4" />
              <span className="ml-1.5 text-xs">Split</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Split clip at playhead (S)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDuplicateClips}
              disabled={!hasSelection}
              className="h-8 px-2"
            >
              <Copy className="w-4 h-4" />
              <span className="ml-1.5 text-xs">Duplicate</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Duplicate selected clips (Ctrl+D)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteClips}
              disabled={!hasSelection}
              className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4" />
              <span className="ml-1.5 text-xs">Delete</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected clips (Delete)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
