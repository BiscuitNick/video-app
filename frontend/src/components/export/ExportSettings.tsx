import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { useExportStore, type ExportSettings as ExportSettingsType } from '@/stores/useExportStore';

// Quality to CRF mapping (lower CRF = higher quality)
const qualityToCRF = (quality: number): number => {
  // Quality 0-100 maps to CRF 51-18
  // CRF 18 = visually lossless, CRF 28 = default, CRF 51 = worst
  return Math.round(51 - (quality / 100) * 33);
};

const crfToQuality = (crf: number): number => {
  return Math.round(((51 - crf) / 33) * 100);
};

const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
} as const;

const QUALITY_LABELS = {
  0: 'Low',
  25: 'Medium',
  50: 'Good',
  75: 'High',
  100: 'Ultra',
};

export const ExportSettings: React.FC = () => {
  const { settings, setSettings, setCurrentStep } = useExportStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExportSettingsType>({
    defaultValues: settings || undefined,
  });

  const watchAspectRatio = watch('aspectRatio');
  const watchQuality = watch('quality');
  const watchResolution = watch('resolution');

  // Update resolution when aspect ratio changes
  useEffect(() => {
    if (watchAspectRatio && watchAspectRatio !== 'custom') {
      const resolution = ASPECT_RATIOS[watchAspectRatio];
      setValue('resolution.width', resolution.width);
      setValue('resolution.height', resolution.height);
    }
  }, [watchAspectRatio, setValue]);

  const onSubmit = (data: ExportSettingsType) => {
    setSettings(data);
    setCurrentStep('review');
  };

  const getQualityLabel = (quality: number): string => {
    const crf = qualityToCRF(quality);
    return `\${quality}% (CRF: \${crf})`;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Export Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Export Name</Label>
        <Input
          id="name"
          {...register('name', { required: 'Export name is required' })}
          placeholder="My Video Export"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <Label htmlFor="aspectRatio">Aspect Ratio</Label>
        <Select
          value={watch('aspectRatio')}
          onValueChange={(value) => setValue('aspectRatio', value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select aspect ratio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
            <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
            <SelectItem value="1:1">1:1 (Square)</SelectItem>
            <SelectItem value="4:3">4:3 (Classic)</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resolution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="width">Width</Label>
          <Input
            id="width"
            type="number"
            {...register('resolution.width', {
              required: 'Width is required',
              min: { value: 128, message: 'Minimum width is 128px' },
              max: { value: 7680, message: 'Maximum width is 7680px' },
            })}
            disabled={watchAspectRatio !== 'custom'}
          />
          {errors.resolution?.width && (
            <p className="text-sm text-destructive">
              {errors.resolution.width.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Height</Label>
          <Input
            id="height"
            type="number"
            {...register('resolution.height', {
              required: 'Height is required',
              min: { value: 128, message: 'Minimum height is 128px' },
              max: { value: 7680, message: 'Maximum height is 7680px' },
            })}
            disabled={watchAspectRatio !== 'custom'}
          />
          {errors.resolution?.height && (
            <p className="text-sm text-destructive">
              {errors.resolution.height.message}
            </p>
          )}
        </div>
      </div>

      {/* Format */}
      <div className="space-y-2">
        <Label htmlFor="format">Format</Label>
        <Select
          value={watch('format')}
          onValueChange={(value) => setValue('format', value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mp4">MP4 (H.264)</SelectItem>
            <SelectItem value="mov">MOV (QuickTime)</SelectItem>
            <SelectItem value="webm">WebM (VP9)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quality Slider */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label htmlFor="quality">Quality</Label>
          <span className="text-sm text-muted-foreground">
            {getQualityLabel(watchQuality || 75)}
          </span>
        </div>
        <Slider
          id="quality"
          min={0}
          max={100}
          step={5}
          value={[watchQuality || 75]}
          onValueChange={(value) => setValue('quality', value[0])}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
          <span>Ultra</span>
        </div>
      </div>

      {/* Frame Rate */}
      <div className="space-y-2">
        <Label htmlFor="frameRate">Frame Rate (FPS)</Label>
        <Select
          value={watch('frameRate')?.toString()}
          onValueChange={(value) => setValue('frameRate', parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select frame rate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24">24 FPS (Cinema)</SelectItem>
            <SelectItem value="30">30 FPS (Standard)</SelectItem>
            <SelectItem value="60">60 FPS (Smooth)</SelectItem>
            <SelectItem value="120">120 FPS (High Speed)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Preview Card */}
      <Card className="p-4">
        <div className="space-y-2">
          <h3 className="font-medium">Preview</h3>
          <div className="bg-muted rounded-md aspect-video flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="text-sm">
                {watchResolution?.width || 1920} x {watchResolution?.height || 1080}
              </div>
              <div className="text-xs mt-1">
                {watch('format')?.toUpperCase() || 'MP4'} • {watch('frameRate') || 30} FPS
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            First frame preview will appear here
          </p>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button type="submit">Continue to Review</Button>
      </div>
    </form>
  );
};
