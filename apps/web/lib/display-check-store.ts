"use client";

let _setOpen: ((v: boolean) => void) | null = null;

export function openDisplayCheck(): void {
  _setOpen?.(true);
}

export function registerDisplayCheckSetter(setter: (v: boolean) => void): void {
  _setOpen = setter;
}
