import { cn } from "@/lib/utils";
import React from "react";

interface LeverSwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const LeverSwitch = React.forwardRef<HTMLInputElement, LeverSwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className={cn("lever-toggle-container", className)}>
        <input 
          {...props}
          ref={ref}
          className="lever-toggle-input" 
          type="checkbox"
        />
        <div className="lever-toggle-handle-wrapper">
          <div className="lever-toggle-handle">
            <div className="lever-toggle-handle-knob"></div>
            <div className="lever-toggle-handle-bar-wrapper">
              <div className="lever-toggle-handle-bar"></div>
            </div>
          </div>
        </div>
        <div className="lever-toggle-base">
          <div className="lever-toggle-base-inside"></div>
        </div>
      </div>
    );
  }
);

LeverSwitch.displayName = "LeverSwitch";
