import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TextOverlayEffect, TextAnimationType } from '@/types/effects';

const fontFamilies = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Arial Black',
];

const fontWeights = [
  { value: 'normal', label: 'Normal' },
  { value: '300', label: 'Light' },
  { value: '500', label: 'Medium' },
  { value: 'bold', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
] as const;

const animations: { value: TextAnimationType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'fade-out', label: 'Fade Out' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
];

interface TextOverlayCreatorProps {
  onApplyText: (textOverlay: Omit<TextOverlayEffect, 'id' | 'enabled'>) => void;
  selectedClipId?: string;
  clipDuration?: number;
}

export const TextOverlayCreator: React.FC<TextOverlayCreatorProps> = ({
  onApplyText,
  selectedClipId,
  clipDuration = 5,
}) => {
  const [text, setText] = useState('Your Text Here');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(48);
  const [fontWeight, setFontWeight] = useState<string>('bold');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [color, setColor] = useState('#ffffff');
  const [backgroundColor, setBackgroundColor] = useState('');
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [shadowEnabled, setShadowEnabled] = useState(true);
  const [shadowOffsetX, setShadowOffsetX] = useState(2);
  const [shadowOffsetY, setShadowOffsetY] = useState(2);
  const [shadowBlur, setShadowBlur] = useState(4);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [animationType, setAnimationType] = useState<TextAnimationType>('fade-in');
  const [animationDuration, setAnimationDuration] = useState(1);
  const [animationDelay, setAnimationDelay] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [duration, setDuration] = useState(Math.min(3, clipDuration));
  const [padding, setPadding] = useState(0);
  const [borderRadius, setBorderRadius] = useState(0);

  const handleApply = () => {
    const textOverlay: Omit<TextOverlayEffect, 'id' | 'enabled'> = {
      type: 'textOverlay',
      name: 'Text: ' + text.substring(0, 20),
      text,
      position: {
        x: positionX,
        y: positionY,
      },
      style: {
        fontFamily,
        fontSize,
        color,
        backgroundColor: backgroundColor || undefined,
        fontWeight: fontWeight as TextOverlayEffect['style']['fontWeight'],
        fontStyle,
        textAlign,
        textShadow: shadowEnabled
          ? {
              offsetX: shadowOffsetX,
              offsetY: shadowOffsetY,
              blur: shadowBlur,
              color: shadowColor,
            }
          : undefined,
        padding: padding > 0 ? padding : undefined,
        borderRadius: borderRadius > 0 ? borderRadius : undefined,
      },
      animation:
        animationType !== 'none'
          ? {
              type: animationType,
              duration: animationDuration,
              delay: animationDelay > 0 ? animationDelay : undefined,
            }
          : undefined,
      startTime,
      duration,
    };

    onApplyText(textOverlay);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {selectedClipId
          ? 'Create text overlay for the selected clip'
          : 'Select a clip first to add text'}
      </div>

      {/* Preview */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
        <CardContent className="p-8">
          <div
            className="transition-all"
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              color,
              fontWeight: fontWeight as any,
              fontStyle,
              textAlign,
              backgroundColor: backgroundColor || 'transparent',
              padding: padding > 0 ? `${padding}px` : undefined,
              borderRadius: borderRadius > 0 ? `${borderRadius}px` : undefined,
              textShadow: shadowEnabled
                ? `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`
                : undefined,
            }}
          >
            {text || 'Your Text Here'}
          </div>
        </CardContent>
      </Card>

      {/* Text Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Text Content</label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your text"
          disabled={!selectedClipId}
        />
      </div>

      {/* Font Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Font Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Font Family</label>
              <Select value={fontFamily} onValueChange={setFontFamily} disabled={!selectedClipId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilies.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Font Weight</label>
              <Select value={fontWeight} onValueChange={setFontWeight} disabled={!selectedClipId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontWeights.map((fw) => (
                    <SelectItem key={fw.value} value={fw.value}>
                      {fw.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Font Size</label>
              <span className="text-sm text-muted-foreground">{fontSize}px</span>
            </div>
            <Slider
              value={[fontSize]}
              onValueChange={(values) => setFontSize(values[0])}
              min={12}
              max={120}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Text Color</label>
              <div className="flex space-x-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-10 p-1"
                  disabled={!selectedClipId}
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#ffffff"
                  disabled={!selectedClipId}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Background</label>
              <div className="flex space-x-2">
                <Input
                  type="color"
                  value={backgroundColor || '#000000'}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-16 h-10 p-1"
                  disabled={!selectedClipId}
                />
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="transparent"
                  disabled={!selectedClipId}
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant={fontStyle === 'italic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFontStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
              disabled={!selectedClipId}
            >
              Italic
            </Button>
            <Button
              variant={textAlign === 'left' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTextAlign('left')}
              disabled={!selectedClipId}
            >
              Left
            </Button>
            <Button
              variant={textAlign === 'center' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTextAlign('center')}
              disabled={!selectedClipId}
            >
              Center
            </Button>
            <Button
              variant={textAlign === 'right' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTextAlign('right')}
              disabled={!selectedClipId}
            >
              Right
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Position */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Position</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Horizontal (X)</label>
              <span className="text-sm text-muted-foreground">{positionX}%</span>
            </div>
            <Slider
              value={[positionX]}
              onValueChange={(values) => setPositionX(values[0])}
              min={0}
              max={100}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Vertical (Y)</label>
              <span className="text-sm text-muted-foreground">{positionY}%</span>
            </div>
            <Slider
              value={[positionY]}
              onValueChange={(values) => setPositionY(values[0])}
              min={0}
              max={100}
              step={1}
              disabled={!selectedClipId}
            />
          </div>
        </CardContent>
      </Card>

      {/* Shadow */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Text Shadow</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShadowEnabled(!shadowEnabled)}
              disabled={!selectedClipId}
            >
              {shadowEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardHeader>
        {shadowEnabled && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Offset X</label>
                  <span className="text-sm text-muted-foreground">{shadowOffsetX}px</span>
                </div>
                <Slider
                  value={[shadowOffsetX]}
                  onValueChange={(values) => setShadowOffsetX(values[0])}
                  min={-10}
                  max={10}
                  step={1}
                  disabled={!selectedClipId}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Offset Y</label>
                  <span className="text-sm text-muted-foreground">{shadowOffsetY}px</span>
                </div>
                <Slider
                  value={[shadowOffsetY]}
                  onValueChange={(values) => setShadowOffsetY(values[0])}
                  min={-10}
                  max={10}
                  step={1}
                  disabled={!selectedClipId}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Blur</label>
                <span className="text-sm text-muted-foreground">{shadowBlur}px</span>
              </div>
              <Slider
                value={[shadowBlur]}
                onValueChange={(values) => setShadowBlur(values[0])}
                min={0}
                max={20}
                step={1}
                disabled={!selectedClipId}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Shadow Color</label>
              <div className="flex space-x-2">
                <Input
                  type="color"
                  value={shadowColor}
                  onChange={(e) => setShadowColor(e.target.value)}
                  className="w-16 h-10 p-1"
                  disabled={!selectedClipId}
                />
                <Input
                  value={shadowColor}
                  onChange={(e) => setShadowColor(e.target.value)}
                  disabled={!selectedClipId}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Style */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Background Style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Padding</label>
              <span className="text-sm text-muted-foreground">{padding}px</span>
            </div>
            <Slider
              value={[padding]}
              onValueChange={(values) => setPadding(values[0])}
              min={0}
              max={50}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Border Radius</label>
              <span className="text-sm text-muted-foreground">{borderRadius}px</span>
            </div>
            <Slider
              value={[borderRadius]}
              onValueChange={(values) => setBorderRadius(values[0])}
              min={0}
              max={50}
              step={1}
              disabled={!selectedClipId}
            />
          </div>
        </CardContent>
      </Card>

      {/* Animation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Animation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Animation Type</label>
            <Select value={animationType} onValueChange={(v) => setAnimationType(v as TextAnimationType)} disabled={!selectedClipId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {animations.map((anim) => (
                  <SelectItem key={anim.value} value={anim.value}>
                    {anim.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {animationType !== 'none' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Animation Duration</label>
                  <span className="text-sm text-muted-foreground">{animationDuration.toFixed(1)}s</span>
                </div>
                <Slider
                  value={[animationDuration]}
                  onValueChange={(values) => setAnimationDuration(values[0])}
                  min={0.1}
                  max={5}
                  step={0.1}
                  disabled={!selectedClipId}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Animation Delay</label>
                  <span className="text-sm text-muted-foreground">{animationDelay.toFixed(1)}s</span>
                </div>
                <Slider
                  value={[animationDelay]}
                  onValueChange={(values) => setAnimationDelay(values[0])}
                  min={0}
                  max={5}
                  step={0.1}
                  disabled={!selectedClipId}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timing</CardTitle>
          <CardDescription>Relative to clip start</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Start Time</label>
              <span className="text-sm text-muted-foreground">{startTime.toFixed(1)}s</span>
            </div>
            <Slider
              value={[startTime]}
              onValueChange={(values) => setStartTime(values[0])}
              min={0}
              max={clipDuration}
              step={0.1}
              disabled={!selectedClipId}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Duration</label>
              <span className="text-sm text-muted-foreground">{duration.toFixed(1)}s</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={(values) => setDuration(values[0])}
              min={0.1}
              max={clipDuration - startTime}
              step={0.1}
              disabled={!selectedClipId}
            />
          </div>
        </CardContent>
      </Card>

      {/* Apply Button */}
      <Button className="w-full" onClick={handleApply} disabled={!selectedClipId || !text}>
        Add Text Overlay
      </Button>
    </div>
  );
};
