---
title: "07 数据访问：如何使用JdbcTemplate访问关系型数据库？"
index: true
icon: seedling
---

因为 JDBC 是偏底层的操作规范，所以关于如何使用 JDBC 规范进行关系型数据访问的实现方式有很多（区别在于对 JDBC 规范的封装程度不同），而在 Spring
中，同样提供了 JdbcTemplate 模板工具类实现数据访问，它简化了 JDBC 规范的使用方法，今天我们将围绕这个模板类展开讨论。

## 数据模型和 Repository 层设计
我们知道一个订单中往往涉及一个或多个商品，所以在本案例中，我们主要通过一对多的关系来展示数据库设计和实现方面的技巧。而为了使描述更简单，我们把具体的业务字段做了简化。
```java
public class Order{

    private Long id; //订单Id

    private String orderNumber; //订单编号

    private String deliveryAddress; //物流地址

    private List<Goods> goodsList;  //商品列表

    //省略了 getter/setter

}

public class Goods {

    private Long id; //商品Id

    private String goodsCode; //商品编号

    private String goodsName; //商品名称

    private Double price; //商品价格

    //省略了 getter/setter

}
```
从以上代码，我们不难看出一个订单可以包含多个商品，因此设计关系型数据库表时，我们首先会构建一个中间表来保存 Order 和 Goods 这层一对多关系。
在本课程中，我们使用 MySQL 作为关系型数据库，对应的数据库 Schema 定义如下代码所示：
```sql
DROP TABLE IF EXISTS `order`;

DROP TABLE IF EXISTS `goods`;

DROP TABLE IF EXISTS `order_goods`;

 

create table `order` (

    `id` bigint(20) NOT NULL AUTO_INCREMENT,

    `order_number` varchar(50) not null,

    `delivery_address` varchar(100) not null,

  `create_time` timestamp not null DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`)

);

 

create table `goods` (

  `id` bigint(20) NOT NULL AUTO_INCREMENT,

  `goods_code` varchar(50) not null,

  `goods_name` varchar(50) not null,

  `goods_price` double not null,

  `create_time` timestamp not null DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`)

);

 

create table `order_goods` (

    `order_id` bigint(20) not null,

    `goods_id` bigint(20) not null,

    foreign key(`order_id`) references `order`(`id`),

    foreign key(`goods_id`) references `goods`(`id`)

);
```
基于以上数据模型，我们将完成 order-server 中的 Repository 层组件的设计和实现。首先，我们需要设计一个 OrderRepository 接口，用来抽象数据库访问的入口，如下代码所示：
```java
public interface OrderRepository {

    Order addOrder(Order order);

    Order getOrderById(Long orderId);

    Order getOrderDetailByOrderNumber(String orderNumber);
}
```
这个接口非常简单，方法都是自解释的。不过请注意，这里的 OrderRepository 并没有继承任何父接口，完全是一个自定义的、独立的 Repository。

针对上述 OrderRepository 中的接口定义，我们将构建一系列的实现类。

* OrderRawJdbcRepository：使用原生 JDBC 进行数据库访问
* OrderJdbcRepository：使用 JdbcTemplate 进行数据库访问
* OrderJpaRepository：使用 Spring Data JPA 进行数据库访问

上述实现类中的 OrderJpaRepository 我们会放到 10 讲《ORM 集成：如何使用 Spring Data JPA 访问关系型数据库？》中进行展开，而 
OrderRawJdbcRepository 最基础，不是本课程的重点，因此 07 讲我们只针对 OrderRepository 中 getOrderById 方法的实现过程重点介绍，也算是对 
06 讲的回顾和扩展。
```java
@Repository("orderRawJdbcRepository")
public class OrderRawJdbcRepository implements OrderRepository {
    
    @Autowired
    private DataSource dataSource;
    
    @Override
    public Order getOrderById(Long orderId) {
        Connection connection = null;

        PreparedStatement statement = null;

        ResultSet resultSet = null;

        try {
            connection = dataSource.getConnection();
            statement = connection.prepareStatement("select id, order_number, delivery_address from `order` where id=?");
            statement.setLong(1, orderId);
            resultSet = statement.executeQuery();
            Order order = null;
            if (resultSet.next()) {
                order = new Order(resultSet.getLong("id"), resultSet.getString("order_number"),
                        resultSet.getString("delivery_address"));
            }
            return order;
        } catch (SQLException e) {
            System.out.print(e);
        } finally {
            if (resultSet != null) {
                try {
                    resultSet.close();
                } catch (SQLException e) {
                }
            }

            if (statement != null) {
                try {
                    statement.close();
                } catch (SQLException e) {
                }
            }
            if (connection != null) {
                try {
                    connection.close();
                } catch (SQLException e) {

                }
            }
        }
        return null;
    }
    //省略其他 OrderRepository 接口方法实现

}
```
这里，值得注意的是，我们首先需要在类定义上添加 @Repository 注解，标明这是能够被 Spring 容器自动扫描的 Javabean，再在 @Repository 注解中指
定这个 Javabean 的名称为”orderRawJdbcRepository”，方便 Service 层中根据该名称注入 OrderRawJdbcRepository 类。

可以看到，上述代码使用了 JDBC 原生 DataSource、Connection、PreparedStatement、ResultSet 等核心编程对象完成针对“order”表的一次查询。
代码流程看起来比较简单，其实也比较烦琐，学到这里，我们可以结合上一课时的内容理解上述代码。

请注意，如果我们想运行这些代码，千万别忘了在 Spring Boot 的配置文件中添加对 DataSource 的定义，如下代码所示：
```yaml
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/appointment
    username: root
    password: root
```

## 使用JdbcTemplate操作数据库
引入JdbcTemplate依赖
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
```
JdbcTemplate 提供了一系列的 query、update、execute 重载方法应对数据的 CRUD 操作。

### 使用JdbcTemplate实现查询
```java
@Repository("orderJdbcRepository")
public class OrderJdbcRepository implements OrderRepository {
    private JdbcTemplate jdbcTemplate;
    
    @Autowired
    public OrderJdbcRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
	}
}
```
可以看到，这里通过构造函数注入了JdbcTemplate模板类。而OrderJdbcRepository 的 getOrderById方法实现过程如下代码所示：
```java
@Override
public Order getOrderById(Long orderId) {
    return jdbcTemplate.queryForObject("select id, order_number, delivery_address from `order` where id=?",
            this::mapRowToOrder, orderId);
}
```
显然，这里使用了 JdbcTemplate 的 queryForObject 方法执行查询操作，该方法传入目标 SQL、参数以及一个 RowMapper 对象。其中 RowMapper 定义如下：
```java
public interface RowMapper<T> {
    
    T mapRow(ResultSet rs, int rowNum) throws SQLException;
}
```
从 mapRow 方法定义中，我们不难看出 RowMapper 的作用就是处理来自 ResultSet 中的每一行数据，并将来自数据库中的数据映射成领域对象。例如，使用 
getOrderById 中用到的 mapRowToOrder 方法完成对 Order 对象的映射，如下代码所示：
```java
private Order mapRowToOrder(ResultSet rs, int rowNum) throws SQLException {
        return new Order(rs.getLong("id"), rs.getString("order_number"), rs.getString("delivery_address"));
}
```
讲到这里，你可能注意到 getOrderById 方法实际上只是获取了 Order 对象中的订单部分信息，并不包含商品数据。

接下来，我们再来设计一个 getOrderDetailByOrderNumber 方法，根据订单编号获取订单以及订单中所包含的所有商品信息，如下代码所示：
```java
@Override

public Order getOrderDetailByOrderNumber(String orderNumber) {
        //获取 Order 基础信息
        Order order = jdbcTemplate.queryForObject(
                "select id, order_number, delivery_address from `order` where order_number=?", this::mapRowToOrder,
                orderNumber);
        if (order == null)
            return order;
        //获取 Order 与 Goods 之间的关联关系，找到给 Order 中的所有 GoodsId
        Long orderId = order.getId();
        List<Long> goodsIds = jdbcTemplate.query("select order_id, goods_id from order_goods where order_id=?",
                new ResultSetExtractor<List<Long>>() {
                    public List<Long> extractData(ResultSet rs) throws SQLException, DataAccessException {
                        List<Long> list = new ArrayList<Long>();
                        while (rs.next()) {
                            list.add(rs.getLong("goods_id"));
                        }
                        return list;
                    }
                }, orderId);
        //根据 GoodsId 分别获取 Goods 信息并填充到 Order 对象中
        for (Long goodsId : goodsIds) {
            Goods goods = getGoodsById(goodsId);
            order.addGoods(goods);
        }
        return order;
}
```