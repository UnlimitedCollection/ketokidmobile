import { format, parseISO } from "date-fns";
import type { MealDay } from "@workspace/api-client-react";

const POPUP_WIDTH = 220;
const POPUP_HEIGHT = 160;
const OFFSET = 14;

interface DayHoverPopupProps {
  day: MealDay;
  x: number;
  y: number;
}

export function DayHoverPopup({ day, x, y }: DayHoverPopupProps) {
  const dateStr = String(day.date);
  const displayDate = format(parseISO(dateStr), "EEEE, MMM d, yyyy");
  const hasData = day.isFilled || day.totalMeals > 0;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 720;
  const left = x + OFFSET + POPUP_WIDTH > vw ? x - POPUP_WIDTH - OFFSET : x + OFFSET;
  const top = y + OFFSET + POPUP_HEIGHT > vh ? y - POPUP_HEIGHT - OFFSET : y + OFFSET;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left, top }}
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[180px] max-w-[220px] text-sm">
        <p className="font-semibold text-slate-800 mb-2 text-xs">{displayDate}</p>
        {!hasData ? (
          <p className="text-slate-400 text-xs italic">No data</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Completed</span>
              <span className="font-bold text-slate-800">{day.completedMeals} / {day.totalMeals}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Missed</span>
              <span className={`font-medium ${day.missedMeals > 0 ? "text-red-500" : "text-slate-700"}`}>{day.missedMeals}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Compliance</span>
              <span className="font-bold text-slate-800">{(day.completionRate * 100).toFixed(0)}%</span>
            </div>
            {(day.totalCalories != null || day.totalCarbs != null || day.totalFat != null || day.totalProtein != null) && (
              <div className="border-t border-slate-100 pt-1.5 mt-1.5 space-y-1">
                {day.totalCalories != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Calories</span>
                    <span className="text-slate-700 font-medium">{Math.round(day.totalCalories)} kcal</span>
                  </div>
                )}
                {day.totalCarbs != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Carbs</span>
                    <span className="text-slate-700 font-medium">{Math.round(day.totalCarbs)} g</span>
                  </div>
                )}
                {day.totalFat != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Fat</span>
                    <span className="text-slate-700 font-medium">{Math.round(day.totalFat)} g</span>
                  </div>
                )}
                {day.totalProtein != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Protein</span>
                    <span className="text-slate-700 font-medium">{Math.round(day.totalProtein)} g</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
