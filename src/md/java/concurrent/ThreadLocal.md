---
title: "ThreadLocal"
index: true
icon: chart-simple
---

## 什么是ThreadLocal？用来解决什么问题？

线程安全的解决思路：

- 互斥同步：synchronized 和 ReentrantLock
- 非阻塞同步： CAS，Atomic原子类
- 无同步方案：栈封闭，本地存储（Thread Local），可重入代码

总结：ThreadLocal是一个将在多线程中为每一个线程创建单独的变量副本的类；使用ThreadLocal来维护变量时,
ThreadLocal会为每个线程创建单独的变量副本, 避免因多线程操作共享变量而导致的数据不一致的情况。

::: tip
ThreadLocal被应用最多的是session管理和数据链接管理，以数据库访问为例理解ThreadLocal：
:::

```java
class ConnectionManager {
    private static Connection connect = null;

    public static Connection openConnection() {
        if (connect == null) {
            connect = DriverManager.getConnection();
        }
        return connect;
    }

    public static void closeConnection() {
        if (connect != null) {
            connect.close();
        }
    }
}
```

多线程中使用会存在线程安全问题：
第一，这里面的2个方法都没有进行同步，很可能在openConnection方法中会多次创建connect；
第二，由于connect是共享变量，那么必然在调用connect的地方需要使用到同步来保障线程安全，因为很可能一个线程在使用connect进行数据库操作，而另外一个线程调用closeConnection关闭链接。

### 优化版本1

```java
class ConnectionManager {
    private Connection connect = null;

    public Connection openConnection() {
        if (connect == null) {
            connect = DriverManager.getConnection();
        }
        return connect;
    }

    public void closeConnection() {
        if (connect != null)
            connect.close();
    }
}

class Dao {
    public void insert() {
        ConnectionManager connectionManager = new ConnectionManager();
        Connection connection = connectionManager.openConnection();

        // 使用connection进行操作

        connectionManager.closeConnection();
    }
}
```

问题：每次都在方法内部创建新的连接，线程之间不存在安全问题，但是会严重影响程序性能，在方法中需要频繁开启和关闭数据库连接，导致服务器压力巨大。

### 优化版本2

通过ThreadLocal在每个线程中对该变量创建一个副本，在线程内部任何地方都可以使用

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class ConnectionManager {

    private static final ThreadLocal<Connection> dbConnectionLocal = new ThreadLocal<Connection>() {
        @Override
        protected Connection initialValue() {
            try {
                return DriverManager.getConnection("", "", "");
            } catch (SQLException e) {
                e.printStackTrace();
            }
            return null;
        }
    };

    public Connection getConnection() {
        return dbConnectionLocal.get();
    }
}
```

- ThreadLocal的修饰符：ThreadLocal instances are typically private static fields in classes that wish to associate state
  with a thread。如果我们希望通过某个类将状态(例如用户ID、事务ID)与线程关联起来，那么通常在这个类中定义private
  static类型的ThreadLocal 实例。
  ::: tip
  虽然ThreadLocal能够解决上面说的问题，但是由于在每个线程中都创建了副本，所以要考虑它对资源的消耗，比如内存的占用会比不使用ThreadLocal要大。
  :::

## ThreadLocal原理

@startuml

interface Runnable

class Thread {
~ threadLocals: ThreadLocal.ThreadLocalMap
}

class ThreadLocal
class ThreadLocalMap
class Entry
class WeakReference<T>

' 关系定义
Runnable <|.. Thread

ThreadLocal *-- ThreadLocalMap
ThreadLocalMap *-- Entry
WeakReference <|-- Entry
@enduml

### 如何实现线程隔离

利用Thread对象中类型为ThreadLocalMap的变量threadLocals，负责存储当前线程的Connection对象，'dbConnectionLocal'
变量为key，新建的Connection对象为value。

```java
public T get() {
    Thread t = Thread.getCurentThread();
    ThreadLocalMap threadLocals = getMap(t);
    if (threadLocals != null) {
        ThreadLocalMap.Entry e = threadLocals.getEntry(this);
        if (e != null) {
            T result = (T) e.value;
            return result;
        }
    }
    return setInitialValue();
}

private T setInitialValue() {
    T value = initialValue();
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);
    if (map != null)
        map.set(this, value);
    else
        createMap(t, value);
    return value;
}

```

@startuml
:获取线程对象t，从线程t中获取ThreadLocalMap的成员属性threadLocals;
if (threadLocals已经初始化) then (yes)
if (ThreadLocal对象key存在) then (yes)
:直接返回当前线程获取的对象;
else (no)
:创建对象，添加到当前线程的ThreadLocalMap中，并返回;
endif
else (no)
:重新创建一个ThreadLocalMap对象，创建一个对象并添加到ThreadLocalMap对象并返回;
endif

@enduml

## ThreadLocalMap对象是什么

- 没有实现Map接口
- 它没有public的方法, 最多有一个default的构造方法, 因为这个ThreadLocalMap的方法仅仅在ThreadLocal类中调用, 属于静态内部类
- ThreadLocalMap的Entry实现继承了WeakReference<ThreadLocal<?>>
- 该方法仅仅用了一个Entry数组来存储Key, Value; Entry并不是链表形式, 而是每个bucket里面仅仅放一个Entry;

## ThreadLocal造成内存泄漏的问题

