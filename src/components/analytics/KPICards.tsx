import React, { useState, useEffect } from "react";
import { Target, TrendingUp, Settings, ChevronRight } from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { DateRange } from "../common/DateRangePicker";

interface KPICardsProps {
    currentRevenue: number;
    currentProfit: number;
    dateRange: DateRange;
}

const KPICards: React.FC<KPICardsProps> = ({ currentRevenue, currentProfit, dateRange }) => {
    // Default goals if not set
    const DEFAULT_REVENUE_GOAL = 150000000;
    const DEFAULT_PROFIT_GOAL = 50000000; // Default profit goal

    const [revenueGoal, setRevenueGoal] = useState<number>(DEFAULT_REVENUE_GOAL);
    const [profitGoal, setProfitGoal] = useState<number>(DEFAULT_PROFIT_GOAL);
    const [isEditing, setIsEditing] = useState(false);

    // Only show Monthly Goal features if "Tháng này" is selected
    const showGoals = dateRange.label === "Tháng này";

    // Load from LocalStorage on mount
    useEffect(() => {
        const savedRevenue = localStorage.getItem("kpi_revenue_target");
        const savedProfit = localStorage.getItem("kpi_profit_target");

        if (savedRevenue) setRevenueGoal(Number(savedRevenue));
        if (savedProfit) setProfitGoal(Number(savedProfit));
    }, []);

    // Save to LocalStorage
    const handleSave = () => {
        localStorage.setItem("kpi_revenue_target", revenueGoal.toString());
        localStorage.setItem("kpi_profit_target", profitGoal.toString());
        setIsEditing(false);
    };

    // Calculations
    const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

    let revenueProgress = 0;
    let profitProgress = 0;
    let daysLeft = 0;
    let expectedProgress = 0;
    let isRevenueBehind = false;
    let isProfitBehind = false;
    let dailyRevenueNeeded = 0;
    let dailyProfitNeeded = 0;

    if (showGoals) {
        // Revenue Progress
        revenueProgress = Math.min((currentRevenue / revenueGoal) * 100, 100);

        // Profit Progress
        profitProgress = Math.min((currentProfit / profitGoal) * 100, 100);

        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDay = now.getDate();
        daysLeft = daysInMonth - currentDay;

        expectedProgress = (currentDay / daysInMonth) * 100;
        isRevenueBehind = revenueProgress < expectedProgress - 5; // Behind by >5%
        isProfitBehind = profitProgress < expectedProgress - 5;

        // Daily run rate needed
        const remainingRevenue = Math.max(0, revenueGoal - currentRevenue);
        dailyRevenueNeeded = daysLeft > 0 ? remainingRevenue / daysLeft : 0;

        const remainingProfit = Math.max(0, profitGoal - currentProfit);
        dailyProfitNeeded = daysLeft > 0 ? remainingProfit / daysLeft : 0;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

            {/* Revenue Goal Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-md relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Target size={80} />
                </div>

                <div className="flex justify-between items-start z-10 relative">
                    <div>
                        <div className="text-blue-100 text-sm font-medium mb-1">
                            {showGoals ? "Mục tiêu Doanh thu Tháng" : `Doanh thu (${dateRange.label})`}
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(currentRevenue)}</div>

                        {showGoals && (
                            <div className="text-xs text-blue-200 mt-1">
                                /{formatCurrency(revenueGoal)}
                                <span className="ml-1 opacity-75">({revenueProgress.toFixed(1)}%)</span>
                            </div>
                        )}
                    </div>
                    {showGoals && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                        >
                            <Settings size={16} />
                        </button>
                    )}
                </div>

                {/* Progress Bar (Only show if showGoals) */}
                {showGoals && (
                    <div className="mt-4 z-10 relative">
                        <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${isRevenueBehind ? 'bg-amber-300' : 'bg-green-400'}`}
                                style={{ width: `${revenueProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {showGoals && (
                    <div className="mt-3 flex items-center justify-between z-10 relative text-xs text-blue-100">
                        <div>
                            {daysLeft > 0 ? (
                                <span>Cần {formatCurrency(dailyRevenueNeeded)}/ngày</span>
                            ) : (
                                <span>Đã hết tháng</span>
                            )}
                        </div>
                        <div className="flex items-center">
                            {isRevenueBehind ? (
                                <span className="flex items-center text-amber-200 font-medium bg-amber-500/20 px-1.5 py-0.5 rounded">
                                    <TrendingUp size={12} className="mr-1" />
                                    Chậm tiến độ
                                </span>
                            ) : (
                                <span className="text-green-300 font-medium">Đúng tiến độ</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Profit Goal Card (Amount) */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-5 text-white shadow-md relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp size={80} />
                </div>

                {isEditing ? (
                    <div className="z-10 relative bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                        <h4 className="text-sm font-semibold mb-3">Thiết lập mục tiêu (Tháng)</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs mb-1 block opacity-80">Doanh thu</label>
                                <input
                                    type="number"
                                    value={revenueGoal}
                                    onChange={(e) => setRevenueGoal(Number(e.target.value))}
                                    className="w-full text-slate-800 rounded px-2 py-1 text-sm font-semibold"
                                />
                            </div>
                            <div>
                                <label className="text-xs mb-1 block opacity-80">Lợi nhuận</label>
                                <input
                                    type="number"
                                    value={profitGoal}
                                    onChange={(e) => setProfitGoal(Number(e.target.value))}
                                    className="w-full text-slate-800 rounded px-2 py-1 text-sm font-semibold"
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-white text-emerald-700 font-bold py-1.5 rounded text-xs hover:bg-emerald-50"
                                >
                                    Lưu lại
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-3 bg-black/20 text-white font-medium py-1.5 rounded text-xs hover:bg-black/30"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-start z-10 relative">
                            <div>
                                <div className="text-emerald-100 text-sm font-medium mb-1">
                                    {showGoals ? "Mục tiêu Lợi nhuận Tháng" : `Lợi nhuận (${dateRange.label})`}
                                </div>
                                <div className="text-2xl font-bold">{formatCurrency(currentProfit)}</div>
                                {showGoals && (
                                    <div className="text-xs text-emerald-200 mt-1">
                                        /{formatCurrency(profitGoal)}
                                        <span className="ml-1 opacity-75">({profitProgress.toFixed(1)}%)</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {showGoals && (
                            <div className="mt-4 z-10 relative">
                                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${isProfitBehind ? 'bg-amber-300' : 'bg-white'}`}
                                        style={{ width: `${profitProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {showGoals && (
                            <div className="mt-3 flex items-center justify-between z-10 relative text-xs text-emerald-100">
                                <div>
                                    {daysLeft > 0 ? (
                                        <span>Cần {formatCurrency(dailyProfitNeeded)}/ngày</span>
                                    ) : (
                                        <span>Đã hết tháng</span>
                                    )}
                                </div>
                                <div className="flex items-center">
                                    <span>Margin: {currentMargin.toFixed(1)}%</span>
                                </div>
                            </div>
                        )}
                        {!showGoals && (
                            <div className="mt-3 flex items-center justify-between z-10 relative text-xs text-emerald-100">
                                <div className="flex items-center">
                                    <span>Margin: {currentMargin.toFixed(1)}%</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default KPICards;
