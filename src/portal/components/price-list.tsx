import {styled} from 'styled-components'
import React from 'react'

const formatDateTime = (unixTimestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(unixTimestamp)
}

export const PriceList = (props: {
    data: Array<{
        time: number,       // unixTime
        open: number,
        high: number,
        low: number,
        close: number,
    }>,
    onHighlight: (unixTime: number | null) => void
}) => {
    return <Root onMouseLeave={() => props.onHighlight(null)}>
        <div className={'title-bar'}>
            <span className={'title'}>Price List</span>
            <span className={'comment'}>Last 10 mins</span>
        </div>
        <div>
            {props.data.map(el =>
                <Line key={el.time} unixTime={el.time} value={el.close} onHighlight={() => {props.onHighlight(el.time)}} />
            )}
        </div>
    </Root>
}

const Root = styled.div`
  .title-bar {
    display: flex;
    align-items: center;
    .title {
      font-size: 20px;
      font-weight: bold;
      margin-right: 12px;
    }
    .comment {
      opacity: 0.5;
    }
  }
`

const Line = React.memo((props: {
    unixTime: number,
    value: number,
    onHighlight: () => void
}) => {
    return <LineRoot>
        <span>{formatDateTime(props.unixTime)}</span>
        <span>{props.value.toFixed(1)}</span>
        <span className={'link'} onMouseOver={props.onHighlight}>Highlight</span>
    </LineRoot>
}, (prevProps, nextProps) =>
    prevProps.unixTime === nextProps.unixTime && prevProps.value === nextProps.value
)

const LineRoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  .link {
    cursor: pointer;
    color: #1677FF;

    &:hover {
      color: #69b1ff;
    }
  }
`
