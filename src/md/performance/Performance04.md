---
title: "04 工具实践：如何获取代码性能数据？"
index: true
icon: chart-simple
---

## nmon - 获取系统性能数据

## jvisualvm - 获取JVM性能数据

**jvisualvm插件安装**

要想监控远程的应用，还需要在被监控的App上加入jmx参数

```yaml
-Dcom.sun.management.jmxremote.port=14000
-Dcom.sun.management.jmxremote.authenticate=false
-Dcom.sun.management.jmxremote.ssl=false
```

**jvisualvm CPU性能采样图**

对于一个 Java 应用来说，除了要关注它的 CPU 指标，垃圾回收方面也是不容忽视的性能点，我们主要关注以下三点。

- CPU 分析：统计方法的执行次数和执行耗时，这些数据可用于分析哪个方法执行时间过长，成为热点等。
- 内存分析：可以通过内存监视和内存快照等方式进行分析，进而检测内存泄漏问题，优化内存使用情况。
- 线程分析：可以查看线程的状态变化，以及一些死锁情况。

## JMC - 获取Java应用详细性能数据

JMC集成了JFR（Java Flight Recorder），在Java11中，可以通过`jcmd`命令进行录制，主要包括configure、check、start、dump、stop这五个命令，
其执行顺序为，start-dump-stop，例如：

```shell
jcmd <pid> JFR.start
jcmd <pid> JFR.dump filename=recording.jfr
jcmd <pid> JFR.stop
```

JFR功能是建在JVM内部的，不需要额外依赖，可以直接使用，能够检测大量数据。比如:

* 锁竞争、延迟、阻塞等
* JVM内部，SafePoint、JIT编译等\

**JMC集成了JFR的功能**，关于JMC的使用如下。

### 1.录制

通过录制数据，可以清晰了解到某一分钟内，操作系统资源，以及 JVM 内部的性能数据情况。

### 2.线程

选择相应的线程，即可了解线程的执行情况，比如 Wait、Idle 、Block 等状态和时序。以 C2 编译器线程为例，可以看到详细的热点类，以及方法内联后的代码大小。

### 3.内存

通过内存界面，可以看到每个时间段内内存的申请情况。在排查内存溢出、内存泄漏等情况时，这个功能非常有用。

### 4.锁

一些竞争非常严重的锁信息，以及一些死锁信息，都可以在锁信息界面中找到。 可以看到，一些锁的具体 ID，以及关联的线程信息，都可以进行联动分析。

### 5.文件和Socket

文件和 Socket 界面能够监控对 I/O 的读写，界面一目了然。如果你的应用 I/O 操作比较繁重，比如日志打印比较多、网络读写频繁，就可以在这里监控到相应的信息，
并能够和执行栈关联起来。

### 6.方法调用

这个和 jvisualvm 的功能类似，展示的是方法调用信息和排行。从这里可以看到一些高耗时方法和热点方法。

### 7.垃圾回收

如果垃圾回收过于频繁，就会影响应用的性能。JFR 对垃圾回收进行了详细的记录，比如什么时候发生了垃圾回收，用的什么垃圾回收器，每次垃圾回收的耗时，
甚至是什么原因引起的等问题，都可以在这里看到。

### 8.JIT

JIT 编译后的代码，执行速度会特别快，但它需要一个编译过程。编译界面显示了详细的 JIT 编译过程信息，包括生成后的 CodeCache
大小、方法内联信息等。

### 9.TLAB

JVM 默认给每个线程开辟一个 buffer 区域，用来加速对象分配，这就是 TLAB（Thread Local Allocation Buffer）的概念。这个
buffer，就放在 Eden 区。

原理和 Java 语言中的 ThreadLocal 类似，能够避免对公共区的操作，可以减少一些锁竞争。如下图所示的界面，详细地显示了这个分配过程。

## Arthas - 获取单个请求的调用链耗时

Arthas 是一个 Java 诊断工具，可以排查内存溢出、CPU 飙升、负载高等内容，可以说是一个 jstack、jmap 等命令的大集合。

## wrk - 获取Web接口的性能数据

wrk是一款HTTP压测工具，和ab命令类似，是一个命令行工具

```shell
Running 30s test @ http://127.0.0.1:8080/index.html
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   635.91us    0.89ms  12.92ms   93.69%
    Req/Sec    56.20k     8.07k   62.00k    86.54%
  22464657 requests in 30.00s, 17.76GB read
Requests/sec: 748868.53
Transfer/sec:    606.33MB
```

可以看到，wrk 统计了常见的性能指标，对 Web 服务性能测试非常有用。同时，wrk 支持 Lua 脚本，用来控制
setup、init、delay、request、response
等函数，可以更好地模拟用户请求。

## 小结

为了获取更多性能数据，我们在本课时介绍了以下 5 款工具。

- nmon 获取系统性能数据；
- jvisualvm 获取 JVM 性能数据；
- jmc 获取 Java 应用详细性能数据；
- arthas 获取单个请求的调用链耗时；
- wrk 获取 Web 接口的性能数据。
  可以看出，这些工具有偏低层的、有偏应用的、有偏统计的、有偏细节的，在定位性能问题时，你需要灵活地使用这些工具，既从全貌上掌握应用的属性，也从细节上找
  到性能的瓶颈，对应用性能进行全方位的掌控。

这些工具能够很好地帮助我们找到系统的瓶颈点，那么对代码进行优化时，如何分析优化效果呢？又如何对代码片段进行快速、专业的测试呢？下一课时，
我将介绍“基准测试 JMH”，来解答以上问题。