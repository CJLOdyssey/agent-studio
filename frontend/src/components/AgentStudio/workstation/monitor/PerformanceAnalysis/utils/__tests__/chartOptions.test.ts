import { getResponseTimeOption, getSuccessRateOption } from '../chartOptions';
import type { PerformanceTrendItem } from '../../../../../../api/client/cost';

describe('chartOptions', () => {
  const mockTrendData: PerformanceTrendItem[] = [
    {
      time_bucket: '2024-01-01',
      avg_response_time_s: 1.5,
      success_rate: 98.5,
      calls: 20,
      avg_tokens: 1200,
    },
    {
      time_bucket: '2024-01-02',
      avg_response_time_s: 1.8,
      success_rate: 97.0,
      calls: 25,
      avg_tokens: 1300,
    },
  ];

  describe('getResponseTimeOption', () => {
    it('should return null for empty data', () => {
      const result = getResponseTimeOption([], false);
      expect(result).toBeNull();
    });

    it('should return valid option for non-empty data', () => {
      const result = getResponseTimeOption(mockTrendData, false);
      expect(result).not.toBeNull();
      expect(result?.series).toHaveLength(1);
      expect(result?.series[0].type).toBe('line');
      expect(result?.xAxis.data).toHaveLength(2);
    });

    it('should handle dark theme', () => {
      const resultLight = getResponseTimeOption(mockTrendData, false);
      const resultDark = getResponseTimeOption(mockTrendData, true);

      expect(resultLight).not.toBeNull();
      expect(resultDark).not.toBeNull();

      // Check that theme colors are different
      expect(resultLight?.tooltip.backgroundColor).not.toBe(resultDark?.tooltip.backgroundColor);
    });

    it('should include markLine for SLO', () => {
      const result = getResponseTimeOption(mockTrendData, false);
      expect(result?.series[0].markLine).toBeDefined();
      expect(result?.series[0].markLine.data).toHaveLength(1);
      expect(result?.series[0].markLine.data[0]?.yAxis).toBe(3);
    });
  });

  describe('getSuccessRateOption', () => {
    it('should return null for empty data', () => {
      const result = getSuccessRateOption([], false);
      expect(result).toBeNull();
    });

    it('should return valid option for non-empty data', () => {
      const result = getSuccessRateOption(mockTrendData, false);
      expect(result).not.toBeNull();
      expect(result?.series).toHaveLength(1);
      expect(result?.series[0].type).toBe('line');
      expect(result?.yAxis.min).toBe(80);
      expect(result?.yAxis.max).toBe(100);
    });

    it('should include SLO line at 95%', () => {
      const result = getSuccessRateOption(mockTrendData, false);
      expect(result?.series[0].markLine).toBeDefined();

      const sloLine = result?.series[0].markLine.data.find(
        (item: any) => item.name === 'SLO 目标'
      );
      expect(sloLine).toBeDefined();
      expect(sloLine.yAxis).toBe(95);
    });
  });
});
