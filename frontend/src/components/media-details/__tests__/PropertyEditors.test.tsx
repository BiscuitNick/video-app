import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimecodeInput } from '../TimecodeInput';
import { RangeSlider } from '../RangeSlider';
import { VolumeControl } from '../VolumeControl';
import { NumericInput } from '../NumericInput';
import { OpacitySlider } from '../OpacitySlider';
import { TransitionPicker } from '../TransitionPicker';

describe('Property Editors', () => {
  describe('TimecodeInput', () => {
    it('displays timecode in HH:MM:SS:FF format', () => {
      const onChange = vi.fn();
      render(<TimecodeInput value={90} fps={30} onChange={onChange} />);

      // 90 seconds at 30fps = 00:01:30:00
      expect(screen.getByDisplayValue('00:01:30:00')).toBeInTheDocument();
    });

    it('calls onChange with correct seconds value', () => {
      const onChange = vi.fn();
      render(<TimecodeInput value={0} fps={30} onChange={onChange} />);

      const input = screen.getByDisplayValue('00:00:00:00');
      fireEvent.change(input, { target: { value: '00:00:10:00' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('resets to previous value on invalid input', () => {
      const onChange = vi.fn();
      render(<TimecodeInput value={5} fps={30} onChange={onChange} />);

      const input = screen.getByDisplayValue('00:00:05:00');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('00:00:05:00')).toBeInTheDocument();
    });
  });

  describe('RangeSlider', () => {
    it('renders with label and unit', () => {
      const onChange = vi.fn();
      render(
        <RangeSlider
          label="Speed"
          value={1}
          min={0.1}
          max={4}
          step={0.1}
          onChange={onChange}
          unit="x"
        />
      );

      expect(screen.getByText('Speed')).toBeInTheDocument();
      expect(screen.getByText('x')).toBeInTheDocument();
    });

    it('updates value when input changes', () => {
      const onChange = vi.fn();
      render(
        <RangeSlider
          label="Speed"
          value={1}
          min={0.1}
          max={4}
          step={0.1}
          onChange={onChange}
          unit="x"
        />
      );

      const input = screen.getByDisplayValue('1');
      fireEvent.change(input, { target: { value: '2' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(2);
    });
  });

  describe('VolumeControl', () => {
    it('toggles mute state', () => {
      const onVolumeChange = vi.fn();
      const onMutedChange = vi.fn();

      render(
        <VolumeControl
          volume={100}
          muted={false}
          onVolumeChange={onVolumeChange}
          onMutedChange={onMutedChange}
        />
      );

      const muteButton = screen.getByRole('button');
      fireEvent.click(muteButton);

      expect(onMutedChange).toHaveBeenCalledWith(true);
    });

    it('displays current volume', () => {
      const onVolumeChange = vi.fn();
      const onMutedChange = vi.fn();

      render(
        <VolumeControl
          volume={75}
          muted={false}
          onVolumeChange={onVolumeChange}
          onMutedChange={onMutedChange}
        />
      );

      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('NumericInput', () => {
    it('increments value on arrow up', () => {
      const onChange = vi.fn();
      render(
        <NumericInput
          label="Rotation"
          value={0}
          min={-360}
          max={360}
          step={1}
          onChange={onChange}
          unit="°"
        />
      );

      const input = screen.getByDisplayValue('0');
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('decrements value on arrow down', () => {
      const onChange = vi.fn();
      render(
        <NumericInput
          label="Rotation"
          value={10}
          min={-360}
          max={360}
          step={1}
          onChange={onChange}
          unit="°"
        />
      );

      const input = screen.getByDisplayValue('10');
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(onChange).toHaveBeenCalledWith(9);
    });

    it('clamps value to min/max', () => {
      const onChange = vi.fn();
      render(
        <NumericInput
          label="Rotation"
          value={0}
          min={0}
          max={100}
          onChange={onChange}
        />
      );

      const input = screen.getByDisplayValue('0');
      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(100);
    });
  });

  describe('OpacitySlider', () => {
    it('renders opacity slider with percentage', () => {
      const onChange = vi.fn();
      render(<OpacitySlider value={50} onChange={onChange} />);

      expect(screen.getByText('Opacity')).toBeInTheDocument();
      expect(screen.getByText('%')).toBeInTheDocument();
    });
  });

  describe('TransitionPicker', () => {
    it('shows duration input only when transition type is not none', () => {
      const onTypeChange = vi.fn();
      const onDurationChange = vi.fn();

      const { rerender } = render(
        <TransitionPicker
          type="none"
          duration={0.5}
          onTypeChange={onTypeChange}
          onDurationChange={onDurationChange}
        />
      );

      expect(screen.queryByText('Duration')).not.toBeInTheDocument();

      rerender(
        <TransitionPicker
          type="fade"
          duration={0.5}
          onTypeChange={onTypeChange}
          onDurationChange={onDurationChange}
        />
      );

      expect(screen.getByText('Duration')).toBeInTheDocument();
    });
  });
});
