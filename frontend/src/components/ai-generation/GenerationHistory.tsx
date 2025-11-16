import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Search, Download, Trash2, Image, Video } from 'lucide-react';
import type { GenerationHistoryItem, HistoryFilterOptions } from '../../types/replicate';

interface GenerationHistoryProps {
  history: GenerationHistoryItem[];
  onImport?: (item: GenerationHistoryItem) => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
}

export function GenerationHistory({
  history,
  onImport,
  onDelete,
  onClearAll,
}: GenerationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed'>('all');

  const getFilteredHistory = (): GenerationHistoryItem[] => {
    let filtered = [...history];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.request.prompt.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((item) => item.request.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    return filtered;
  };

  const filteredHistory = getFilteredHistory();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
          <CardDescription>
            View and manage your AI generation history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              Showing {filteredHistory.length} of {history.length} items
            </span>
            {history.length > 0 && onClearAll && (
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Items */}
      {filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {history.length === 0
                ? 'No generation history yet.'
                : 'No items match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredHistory.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {/* Thumbnail */}
              {item.thumbnailUrl && (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.request.prompt}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.request.type === 'image' ? (
                      <Image className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge
                      variant={item.status === 'completed' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {item.status}
                    </Badge>
                  </div>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <CardDescription className="line-clamp-3 text-xs">
                  {item.request.prompt}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  <div>Aspect Ratio: {item.request.aspectRatio}</div>
                  <div>
                    Created: {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                  {item.mediaId && (
                    <div className="text-green-600 font-medium">
                      Imported to Library
                    </div>
                  )}
                </div>

                {/* Import Button */}
                {item.status === 'completed' &&
                  item.outputUrl &&
                  !item.mediaId &&
                  onImport && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => onImport(item)}
                    >
                      <Download className="mr-2 h-3 w-3" />
                      Import to Library
                    </Button>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default GenerationHistory;
