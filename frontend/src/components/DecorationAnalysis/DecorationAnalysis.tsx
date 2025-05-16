import React from 'react';
import styled from 'styled-components';
import { DecorationAnalysisResponse } from '../../services/api';

const AnalysisContainer = styled.div`
  margin: 2rem auto;
  max-width: 800px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 2rem;
`;

const Title = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
`;

const Background = styled.p`
  font-size: 1.1rem;
  line-height: 1.6;
  color: #4a5568;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f7fafc;
  border-radius: 8px;
`;

const Section = styled.div<{ color: string }>`
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 8px;
  background: ${props => `${props.color}10`};
`;

const SectionTitle = styled.h4<{ color: string }>`
  font-size: 1.2rem;
  font-weight: 500;
  color: ${props => props.color};
  margin-bottom: 1rem;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
`;

const ListItem = styled.li<{ color: string }>`
  color: ${props => props.color};
  margin-bottom: 0.5rem;
  padding-left: 1.5rem;
  position: relative;

  &:before {
    content: "•";
    position: absolute;
    left: 0;
    color: ${props => props.color};
  }
`;

interface Props {
  analysis: DecorationAnalysisResponse | null;
}

const DecorationAnalysis: React.FC<Props> = ({ analysis }) => {
  if (!analysis) return null;

  const colors = {
    good: '#059669', // green
    bad: '#DC2626',  // red
    suggestions: '#2563EB' // blue
  };

  return (
    <AnalysisContainer>
      <Title>Room Analysis</Title>
      
      <Background>{analysis.analysis.background}</Background>
      
      <Section color={colors.good}>
        <SectionTitle color={colors.good}>Good Points</SectionTitle>
        <List>
          {analysis.analysis.good_points.map((point: string, index: number) => (
            <ListItem key={index} color={colors.good}>
              {point}
            </ListItem>
          ))}
        </List>
      </Section>
      
      <Section color={colors.bad}>
        <SectionTitle color={colors.bad}>Areas for Improvement</SectionTitle>
        <List>
          {analysis.analysis.bad_points.map((point: string, index: number) => (
            <ListItem key={index} color={colors.bad}>
              {point}
            </ListItem>
          ))}
        </List>
      </Section>
      
      <Section color={colors.suggestions}>
        <SectionTitle color={colors.suggestions}>Suggestions</SectionTitle>
        <List>
          {analysis.analysis.suggestions.map((suggestion: string, index: number) => (
            <ListItem key={index} color={colors.suggestions}>
              {suggestion}
            </ListItem>
          ))}
        </List>
      </Section>
    </AnalysisContainer>
  );
};

export default DecorationAnalysis;