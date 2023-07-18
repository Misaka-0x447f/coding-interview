import Chart from 'echarts-for-react';
import {useBeforeMount, useMixedState} from "../utils/hook";
import {connectIfNot, DatafeedWSInstance, DataPoint} from "../api/datafeed";
import {useRef, useState} from "react";
import {EChartsOption} from "echarts-for-react/src/types";
import {last, cloneDeep, isNull} from 'lodash-es';
import {PriceList} from "./components/price-list";
import {styled} from "styled-components";
import {Button} from "antd";

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
    const [loading, setLoading] = useState(0)
    const [option, setOption, optionRef] = useMixedState<EChartsOption>({
        xAxis: {
            data: []
        },
        yAxis: {
            scale: true
        },  // auto
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
            y: 0,
            x2: 0,
            y2: 0
        }
    })
    const xAxisRaw = useRef<number[]>([])
    const dataRaw = useRef<DataPoint[]>([])

    useBeforeMount(() => {
        setLoading(val => val + 1)
        connectIfNot().finally(() => {
            setLoading(val => val - 1)
        }).then((instance) => {
            datafeed.current = instance
            instance.events.message.sub((msg) => {
                setConnected(true)
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
            setLoading(val => val + 1)
            await connectIfNot().finally(() => {
                setLoading(val => val - 1)
            })
            setConnected(true)
        }
    }

    return <Root>
        <span>备注：即使使用官方示例也无法使 k 线图中的某一项目高亮，怀疑是有 bug，等待调查。官方示例：https://echarts.apache.org/zh/option.html#series-candlestick.emphasis.itemStyle</span>
        <div>
            <Button type="primary" loading={!!loading} disabled={!!loading} onClick={toggle}>{connected ? 'Disconnect' : 'Connect'}</Button>
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
                <PriceList data={dataRaw.current} onHighlight={onHighlight}/>
            </div>
        </div>
    </Root>
}

const Root = styled.div`
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
