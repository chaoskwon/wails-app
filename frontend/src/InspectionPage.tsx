import React from 'react';
import { Row, Col, Card, Input, Progress, Button, Typography } from 'antd';
import { 
  ScheduleOutlined, 
  DeleteOutlined, 
  PrinterOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import './CyberTheme.css'; // 전용 스타일 import

const { Title, Text } = Typography;

const InspectionPage: React.FC = () => {
  // 더미 데이터 정의
  const listData = [
    { name: '4K LED Monitor 27"', ordered: 1, scanned: 1, diff: 0, status: 'completed' },
    { name: 'Wireless Keyboard & Mouse Combo', ordered: 2, scanned: 1, diff: '+1', status: 'diff' },
    { name: 'Ergonomic Office Chair', ordered: 1, scanned: 1, diff: 0, status: 'completed' },
    { name: 'USB-C Docking Station', ordered: 1, scanned: 0, diff: '+1', status: 'diff' },
    { name: 'Heavy Duty Packing Tape (3-Pack)', ordered: 2, scanned: 0, diff: '+2', status: 'diff' },
  ];

  return (
    // 전체를 감싸는 컨테이너에 'cyber-container' 클래스 적용
    <div className="cyber-container">
      <Row gutter={24} style={{ height: '100%' }}>
        
        {/* --- 좌측 리스트 영역 --- */}
        <Col span={14} style={{ display: 'flex', flexDirection: 'column' }}>
          <Title level={3} className="cyber-title">
            <ScheduleOutlined /> INSPECTION LIST
          </Title>

          {/* 커스텀 헤더 */}
          <div className="cyber-list-header">
            <span style={{ flex: 4 }}>PRODUCT NAME</span>
            <span style={{ flex: 1, textAlign: 'center' }}>ORDERED QTY</span>
            <span style={{ flex: 1, textAlign: 'center' }}>SCANNED QTY</span>
            <span style={{ flex: 1, textAlign: 'center' }}>DIFF</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10 }}>
            {listData.map((item, index) => (
              <Card key={index} className={`cyber-list-item ${item.status}`} bordered={false}>
                <span style={{ flex: 4, fontSize: 16, fontWeight: 500 }}>{item.name}</span>
                
                {/* 수량 및 차이 표시 영역 */}
                <div style={{ flex: 3, display: 'flex', justifyContent: 'space-between', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
                  {/* 색상 처리: 완료는 초록, 차이는 빨강 */}
                  <span style={{ flex: 1, color: item.status === 'completed' ? 'var(--neon-green)' : 'var(--neon-blue)' }}>
                    {item.ordered}
                  </span>
                  <span style={{ flex: 1, color: item.status === 'completed' ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                    {item.scanned}
                  </span>
                  <span style={{ flex: 1, color: item.diff === 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                    {item.diff === 0 ? '0' : item.diff}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </Col>

        {/* --- 우측 스캔 및 정보 패널 영역 --- */}
        <Col span={10} style={{ height: '100%' }}>
          <div className="cyber-panel">
            
            {/* 스캔 입력 */}
            <div>
              <Text strong style={{ color: 'var(--neon-blue)', fontSize: 16, display: 'block', marginBottom: 10 }}>
                SCAN INPUT:
              </Text>
              <Input size="large" className="cyber-input" placeholder="____________" autoFocus />
            </div>

            {/* 카운터 */}
            <div>
              <div className="cyber-stat-text">
                TOTAL ORDERED: <span className="cyber-stat-value" style={{ color: 'var(--neon-blue)' }}>5</span>
              </div>
              <div className="cyber-stat-text">
                TOTAL SCANNED: <span className="cyber-stat-value" style={{ color: 'var(--neon-blue)' }}>3</span>
              </div>
            </div>

            {/* 진행률 바 */}
            <div style={{ textAlign: 'center' }}>
              <Progress 
                percent={60} 
                strokeColor={{ '0%': 'var(--neon-green)', '100%': '#00ff88' }}
                trailColor="#333"
                strokeWidth={30}
                className="cyber-progress"
                format={percent => <span style={{color: 'black'}}>{percent}%</span>}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, color: '#aaa', fontSize: 12 }}>
                <span>COMPLETED</span><span>PENDING</span>
              </div>
            </div>

            {/* 수령인 정보 */}
            <div>
              <Title level={4} className="cyber-title" style={{ fontSize: 18, marginBottom: 10 }}>
                RECIPIENT INFO
              </Title>
              <div style={{ color: '#ddd', lineHeight: 1.6 }}>
                <div>NAME: <span style={{ marginLeft: 10 }}>John Doe</span></div>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span>ADDRESS:</span>
                  <div style={{ marginLeft: 10 }}>
                    Seoul, Korea <br/> (Masked: *****-*****)
                  </div>
                  <EnvironmentOutlined style={{ marginLeft: 'auto', fontSize: 24, color: '#aaa' }} />
                </div>
              </div>
            </div>

            {/* 하단 액션 버튼 */}
            <div style={{ marginTop: 'auto', display: 'flex', gap: 15 }}>
              <Button type="primary" size="large" block className="cyber-btn cyber-btn-yellow">
                <DeleteOutlined /> CLEAR
              </Button>
              <Button type="primary" size="large" block className="cyber-btn cyber-btn-blue">
                <PrinterOutlined /> REPRINT
              </Button>
            </div>

          </div>
        </Col>
      </Row>
    </div>
  );
};

export default InspectionPage;