import Chart from 'echarts-for-react';
import {useBeforeMount, useMixedState} from "../utils/hook";
import {connectIfNot, DatafeedWSInstance, DataPoint} from "../api/datafeed";
import {useRef, useState} from "react";
import {EChartsOption} from "echarts-for-react/src/types";
import {last, cloneDeep, isNull, isNumber} from 'lodash-es';
import {PriceList} from "./components/price-list";
import {styled} from "styled-components";
import {Button} from "antd";
import {RetryStatus} from "../api/interface/websocket";

const dataLimit = 10000
const formatTime = (unixTimestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
    }).format(unixTimestamp)
}

function Portal() {
    const datafeed = useRef<null | DatafeedWSInstance>()
    const echartRef = useRef<null | Chart>(null)
    const [connected, setConnected] = useState(false)
    const [loading, setLoading] = useState(false)
    const [reconnectStatus, setReconnectStatus] = useState(undefined as RetryStatus | undefined | number)
    const [option, setOption, optionRef] = useMixedState<EChartsOption>({
        xAxis: {
            data: []
        },
        yAxis: {
            scale: true,
            position: 'right',
        },
        series: [{
            type: 'candlestick',
            data: [],
            barMaxWidth: 20,
            emphasis: {
                disabled: false,
                focus: 'self',
                blurScope: 'coordinateSystem',
            }
        }],
        tooltip: {
            trigger: 'item'
        },
        grid: {
            x: 0,
            y: 30,
            x2: 80,
            y2: 30
        },
        axisPointer: {
            link: [
                {
                    xAxisIndex: 'all'
                }
            ],
            label: {
                backgroundColor: '#777'
            }
        },
    })
    const xAxisRaw = useRef<number[]>([])
    const dataRaw = useRef<DataPoint[]>([])

    useBeforeMount(() => {
        datafeed.current = connectIfNot()
        datafeed.current.events.retry.sub(({retryStatus, countdownMilliseconds}) => {
            setLoading(true)
            setReconnectStatus(_ => {
                if (retryStatus === 'sleep') {
                    return countdownMilliseconds
                } else {
                    return retryStatus
                }
            })
        })
        setLoading(true)
        datafeed.current.events.opening.sub(() => {
            setLoading(true)
        })
        datafeed.current.events.closed.sub(() => {
            setConnected(false)
        })
        datafeed.current.events.message.sub((msg) => {
            setConnected(true)
            setLoading(false)
            const current = cloneDeep(optionRef.current)
            if (current.xAxis.data.length && current.xAxis.data.length >= dataLimit) {
                current.xAxis.data.shift()
                current.series[0].data.shift()
                xAxisRaw.current.shift()
                dataRaw.current.shift()
            }
            const data = [msg.open, msg.high, msg.low, msg.close]
            if (!xAxisRaw.current.length || msg.time !== last(xAxisRaw.current)) {
                xAxisRaw.current.push(msg.time)
                current.xAxis.data.push(formatTime(msg.time))
                current.series[0].data.push(data)
                dataRaw.current.push(msg)
            } else {
                current.series[0].data[current.series[0].data.length - 1] = data
                dataRaw.current[dataRaw.current.length - 1] = msg
            }
            setOption(current)
        })
    })

    const onHighlight = (unixTimeStamp: number | null) => {
        if (!echartRef.current) {
            throw new Error('echart ref is not available and this is not expected.')
        }
        const instance = echartRef.current.getEchartsInstance()
        if (isNull(unixTimeStamp)) {
            instance.dispatchAction({
                type: 'downplay',
            })
            instance.dispatchAction({
                type: 'hideTip',
            })
        } else {
            instance.dispatchAction({
                type: 'highlight',
                seriesIndex: 0,
                dataIndex: xAxisRaw.current.indexOf(unixTimeStamp)
            })
            instance.dispatchAction({
                type: 'showTip',
                seriesIndex: 0,
                dataIndex: xAxisRaw.current.indexOf(unixTimeStamp)
            })
        }
    }

    const toggle = async () => {
        if (connected) {
            datafeed.current.close()
            setConnected(false)
        } else {
            connectIfNot()
            setConnected(true)
        }
    }

    return <Root>
        <span>备注：即使使用官方示例也无法使 k 线图中的某一项目高亮，怀疑是有 bug，或者有配置项目没配对，等待调查。官方示例：https://echarts.apache.org/zh/option.html#series-candlestick.emphasis.itemStyle</span>
        <div className={'status-bar'}>
            <Button type={connected ? undefined : "primary"} size={'large'} danger={connected} loading={!!loading}
                    disabled={!!loading} onClick={toggle}>{connected ? '脱机' : '联机'}</Button>
            <div className={'status'}>
                {(() => {
                    if (!reconnectStatus || reconnectStatus === 'connected') return <span>要模拟连接中断，对于 chromium，请使用开发者工具。对于 firefox，请使用扩展。</span>
                    if (isNumber(reconnectStatus)) return <div>
                        <span>连接中断。将于 {Math.floor(reconnectStatus as unknown as number / 1000)} 秒后重试连接。</span>
                        <Button type="link" onClick={() => datafeed.current.reopen()} size={'small'}>现在重试</Button>
                    </div>
                    return <span>自动重试...</span>
                })()}
            </div>
        </div>
        <div className={'container'}>
            <div className={'chart-container'}>
                <Chart
                    ref={(e) => {
                        echartRef.current = e;
                    }}
                    option={option}
                />
            </div>
            <div className={'list-container'}>
                <PriceList data={dataRaw.current.concat().reverse()} onHighlight={onHighlight}/>
            </div>
        </div>
    </Root>
}

const Root = styled.div`
  .status-bar {
    margin: 8px 0;
    display: flex;
    align-items: center;

    .status {
      margin-left: 8px;
    }
  }

  .container {
    display: flex;
    margin-top: 16px;

    .chart-container {
      flex: 1;
      margin-right: 16px;
    }

    .list-container {
      width: 30vw;
      min-width: 350px;
    }
  }
`

export default Portal;
