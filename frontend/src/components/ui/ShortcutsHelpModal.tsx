import { useState, useMemo } from 'react';
import { Search, Keyboard, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { Input } from './input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Badge } from './badge';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { ShortcutCategory, ShortcutDefinition } from '@/types/shortcuts';
import { cn } from '@/lib/utils';

interface ShortcutsHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryLabels: Record<ShortcutCategory, string> = {
  playback: 'Playback',
  editing: 'Editing',
  timeline: 'Timeline',
  view: 'View',
  tools: 'Tools',
  navigation: 'Navigation',
};

const categoryDescriptions: Record<ShortcutCategory, string> = {
  playback: 'Control video playback and navigation',
  editing: 'Edit and manipulate clips',
  timeline: 'Navigate and manage the timeline',
  view: 'Control the application view',
  tools: 'Select and use editing tools',
  navigation: 'Navigate between panels',
};

export const ShortcutsHelpModal = ({
  open,
  onOpenChange,
}: ShortcutsHelpModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'all'>('all');

  const { shortcuts, formatKeyCombo } = useKeyboardShortcuts();

  // Group shortcuts by category
  const shortcutsByCategory = useMemo(() => {
    const grouped = new Map<ShortcutCategory, ShortcutDefinition[]>();

    shortcuts.forEach(shortcut => {
      if (!grouped.has(shortcut.category)) {
        grouped.set(shortcut.category, []);
      }
      grouped.get(shortcut.category)!.push(shortcut);
    });

    // Sort each category's shortcuts by name
    grouped.forEach((shortcuts, category) => {
      grouped.set(
        category,
        shortcuts.sort((a, b) => a.name.localeCompare(b.name))
      );
    });

    return grouped;
  }, [shortcuts]);

  // Filter shortcuts based on search query
  const filteredShortcuts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = new Map<ShortcutCategory, ShortcutDefinition[]>();

    shortcutsByCategory.forEach((shortcuts, category) => {
      if (selectedCategory !== 'all' && category !== selectedCategory) {
        return;
      }

      const matchingShortcuts = shortcuts.filter(
        shortcut =>
          shortcut.name.toLowerCase().includes(query) ||
          shortcut.description.toLowerCase().includes(query) ||
          shortcut.category.toLowerCase().includes(query)
      );

      if (matchingShortcuts.length > 0) {
        filtered.set(category, matchingShortcuts);
      }
    });

    return filtered;
  }, [shortcutsByCategory, searchQuery, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(shortcutsByCategory.keys()).sort();
  }, [shortcutsByCategory]);

  const renderShortcutKeys = (shortcut: ShortcutDefinition) => {
    const keys = shortcut.customKeys || shortcut.defaultKeys;

    return (
      <div className="flex flex-wrap gap-1">
        {keys.map((keyCombo, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="font-mono text-xs px-2 py-0.5"
          >
            {formatKeyCombo(keyCombo)}
          </Badge>
        ))}
      </div>
    );
  };

  const renderShortcutList = () => {
    if (filteredShortcuts.size === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Keyboard className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No shortcuts found matching "{searchQuery}"</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {Array.from(filteredShortcuts.entries()).map(([category, shortcuts]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold mb-3 text-foreground/80">
              {categoryLabels[category]}
            </h3>
            <div className="space-y-2">
              {shortcuts.map(shortcut => (
                <div
                  key={shortcut.id}
                  className={cn(
                    "flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50 transition-colors",
                    shortcut.enabled === false && "opacity-50"
                  )}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="font-medium text-sm">{shortcut.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {shortcut.description}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {renderShortcutKeys(shortcut)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Browse and search all available keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <Tabs
          value={selectedCategory}
          onValueChange={(value) => setSelectedCategory(value as ShortcutCategory | 'all')}
        >
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map(category => (
              <TabsTrigger key={category} value={category}>
                {categoryLabels[category]}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {shortcutsByCategory.get(category)?.length || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="flex-1 overflow-y-auto mt-4">
            {renderShortcutList()}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="border-t pt-4 mt-4 text-xs text-muted-foreground">
          <p>
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">?</kbd> to
            open this dialog anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
