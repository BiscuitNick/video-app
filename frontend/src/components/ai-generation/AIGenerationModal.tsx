import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Slider } from '../ui/slider';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type {
  ReplicateGenerationRequest,
  AspectRatio,
  GenerationType,
  AdvancedSettings,
} from '../../types/replicate';
import { getTemplatesByType, getTemplateById } from '../../data/generationTemplates';

interface AIGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (request: ReplicateGenerationRequest) => void;
}

export function AIGenerationModal({
  open,
  onOpenChange,
  onGenerate,
}: AIGenerationModalProps) {
  const [type, setType] = useState<GenerationType>('image');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Advanced settings
  const [numInferenceSteps, setNumInferenceSteps] = useState(4);
  const [guidanceScale, setGuidanceScale] = useState(3.5);
  const [fps, setFps] = useState(24);
  const [duration, setDuration] = useState(3);
  const [motionScale, setMotionScale] = useState(1.0);

  const templates = getTemplatesByType(type);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = getTemplateById(templateId);
    if (template) {
      setPrompt(template.prompt);
      if (template.defaultSettings) {
        if (template.defaultSettings.numInferenceSteps !== undefined) {
          setNumInferenceSteps(template.defaultSettings.numInferenceSteps);
        }
        if (template.defaultSettings.guidanceScale !== undefined) {
          setGuidanceScale(template.defaultSettings.guidanceScale);
        }
        if (template.defaultSettings.fps !== undefined) {
          setFps(template.defaultSettings.fps);
        }
        if (template.defaultSettings.duration !== undefined) {
          setDuration(template.defaultSettings.duration);
        }
        if (template.defaultSettings.motionScale !== undefined) {
          setMotionScale(template.defaultSettings.motionScale);
        }
      }
    }
  };

  const handleTypeChange = (newType: GenerationType) => {
    setType(newType);
    setSelectedTemplate('');
    setPrompt('');
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    const advancedSettings: AdvancedSettings = {};

    if (type === 'image') {
      advancedSettings.numInferenceSteps = numInferenceSteps;
      advancedSettings.guidanceScale = guidanceScale;
    } else {
      advancedSettings.fps = fps;
      advancedSettings.duration = duration;
      advancedSettings.motionScale = motionScale;
    }

    const request: ReplicateGenerationRequest = {
      prompt: prompt.trim(),
      type,
      aspectRatio,
      templateId: selectedTemplate || undefined,
      advancedSettings,
    };

    onGenerate(request);
    onOpenChange(false);

    // Reset form
    setPrompt('');
    setSelectedTemplate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Generation</DialogTitle>
          <DialogDescription>
            Generate images and videos using AI. Choose a type, enter your prompt, and
            customize settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Generation Type Selector */}
          <Tabs value={type} onValueChange={(v) => handleTypeChange(v as GenerationType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="image">Image</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Template Selector */}
          <div className="space-y-2">
            <Label htmlFor="template">Template (Optional)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder={
                type === 'image'
                  ? 'Describe the image you want to generate...'
                  : 'Describe the video you want to generate...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length}/500 characters
            </p>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => setAspectRatio(v as AspectRatio)}
            >
              <SelectTrigger id="aspect-ratio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Advanced Settings
                {advancedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {type === 'image' ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="inference-steps">Inference Steps</Label>
                      <span className="text-sm text-muted-foreground">
                        {numInferenceSteps}
                      </span>
                    </div>
                    <Slider
                      id="inference-steps"
                      min={1}
                      max={8}
                      step={1}
                      value={[numInferenceSteps]}
                      onValueChange={(v) => setNumInferenceSteps(v[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher values = better quality but slower generation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="guidance-scale">Guidance Scale</Label>
                      <span className="text-sm text-muted-foreground">
                        {guidanceScale.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      id="guidance-scale"
                      min={1}
                      max={10}
                      step={0.5}
                      value={[guidanceScale]}
                      onValueChange={(v) => setGuidanceScale(v[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      How closely to follow the prompt
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="fps">FPS (Frames Per Second)</Label>
                      <span className="text-sm text-muted-foreground">{fps}</span>
                    </div>
                    <Slider
                      id="fps"
                      min={12}
                      max={60}
                      step={1}
                      value={[fps]}
                      onValueChange={(v) => setFps(v[0])}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="duration">Duration (seconds)</Label>
                      <span className="text-sm text-muted-foreground">{duration}</span>
                    </div>
                    <Slider
                      id="duration"
                      min={1}
                      max={10}
                      step={1}
                      value={[duration]}
                      onValueChange={(v) => setDuration(v[0])}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="motion-scale">Motion Scale</Label>
                      <span className="text-sm text-muted-foreground">
                        {motionScale.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      id="motion-scale"
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      value={[motionScale]}
                      onValueChange={(v) => setMotionScale(v[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      Amount of motion in the video
                    </p>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!prompt.trim()}>
            Generate {type === 'image' ? 'Image' : 'Video'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AIGenerationModal;
