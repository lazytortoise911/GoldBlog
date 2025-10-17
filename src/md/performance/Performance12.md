---
title: "12 案例分析：并行计算让代码“飞“起来"
index: true
icon: chart-simple
---

## 并行获取数据

@startmindmap
caption: 要求：部分数据可以留白，但响应数据必须保证

* 服务接口\n50ms内返回
  ** 并行计算\n结果汇总
  *** 1
  *** 2
  *** ...
  *** 20
  @endmindmap

下面这段代码，是我专门为这个场景封装的一个工具类。它传入了两个参数：一个是要计算的 job 数量，另外一个是整个大任务超时的毫秒数。

```java
public class ParallelFetcher { 
    final long timeout; 
    final CountDownLatch latch; 
    final ThreadPoolExecutor executor = new ThreadPoolExecutor(100, 200, 1, 
            TimeUnit.HOURS, new ArrayBlockingQueue<>(100)); 
    public ParallelFetcher(int jobSize, long timeoutMill) { 
        latch = new CountDownLatch(jobSize); 
        timeout = timeoutMill; 
    } 
    public void submitJob(Runnable runnable) { 
        executor.execute(() -> { 
            runnable.run(); 
            latch.countDown(); 
        }); 
    } 
    public void await() { 
        try { 
            this.latch.await(timeout, TimeUnit.MILLISECONDS); 
        } catch (InterruptedException e) { 
            throw new IllegalStateException(); 
        } 
    } 
    public void dispose() { 
        this.executor.shutdown(); 
    } 
}
```

我们再来看一下线程池的设置，里面有非常多的参数，最大池数量达到了 200 个。那线程数到底设置多少合适呢？按照我们的需求，每次请求需要执行
20 个线程，200 个线程就可以支持 10 个并发量，按照最悲观的 50ms 来算的话，这个接口支持的最小 QPS 就是：1000/50*
10=200。这就是说，如果访问量增加，这个线程数还可以调大。

### I/O密集型任务

对于我们常见的互联网服务来说，大多数是属于 I/O 密集型的，比如等待数据库的 I/O，等待网络 I/O 等。在这种情况下，当线程数量等于
I/O 任务的数量时，效果是最好的。虽然线程上下文切换会有一定的性能损耗，但相对于缓慢的 I/O 来说，这点损失是可以接受的。

上面说的这种情况，是针对同步 I/O 来说的，基本上是一个任务对应一个线程。异步 NIO 会加速这个过程

### 计算密集型任务

计算密集型的任务却正好相反，比如一些耗时的算法逻辑。CPU 要想达到最高的利用率，提高吞吐量，最好的方式就是：让它尽量少地在任务之间切换，此时，线程数等于
CPU 数量，是效率最高的。

了解了任务的这些特点，就可以通过调整线程数量增加服务性能。比如，高性能的网络工具包 Netty，EventLoop 默认的线程数量，就是处理器的
2 倍。如果我们的业务 I/O 比较耗时，此时就容易造成任务的阻塞，解决方式有两种：一是提高 worker 线程池的大小，另外一种方式是让耗时的操作在另外的线程池里运行。

## 从池化对象原理看线程池

线程的资源也是比较昂贵的，频繁地创建和销毁同样会影响系统性能。线程资源是非常适合进行池化的。

```java
public ThreadPoolExecutor(int corePoolSize, 
    int maximumPoolSize, 
    long keepAliveTime, 
    TimeUnit unit, 
    BlockingQueue<Runnable> workQueue, 
    ThreadFactory threadFactory, 
    RejectedExecutionHandler handler)
```

如下图所示，任务被提交后，首先判断它是否达到了最小线程数（coreSize），如果达到了，就将任务缓存在任务队列里。如果队列也满了，会判断线程数量是否达到了最大线程数（maximumPoolSize），如果也达到了，就会进入任务的拒绝策略（handler）。

::: important
// TODO 补充线程池提交任务流程
:::

我们来看一下 Executors 工厂类中默认的几个快捷线程池代码。
